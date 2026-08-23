/**
 * バックエンドの例外をSentryへ送る共通ラッパー([X3])。
 *
 * A0公開で不特定多数からアクセスされる状態になった一方、Cloud Functionsの失敗は
 * Cloud Loggingを能動的に見に行かない限り気づけない。既存の「送信失敗はログに残すだけで
 * 握りつぶす」設計(ログイン通知メール・お問い合わせメール)は、その失敗自体を検知する
 * 手段を持っていなかった。
 */

import * as Sentry from "@sentry/node";
import { HttpsError, onCall } from "firebase-functions/https";

import { resolveProjectId } from "../project-id";
import { redactSensitiveText, scrubEvent } from "./scrub";
import { SENTRY_DSN } from "./secrets";

import type {
  CallableOptions,
  CallableRequest,
  FunctionsErrorCode,
} from "firebase-functions/https";

/**
 * callableが送信完了を待つ上限(ミリ秒)。
 *
 * callableの既定タイムアウトは60秒、`deleteAccount`は300秒あるので、
 * ここで数秒使っても呼び出し全体を壊さない。**待たずに返すとイベントが届かないことがある** —
 * Cloud Functions gen2は応答後にインスタンスを凍結しうるため。
 */
const CALLABLE_FLUSH_TIMEOUT_MS = 2_000;

/** 初期化は1度だけ。Cloud Functionsのインスタンスが使い回される間は再実行しない。 */
let initialized = false;

/** 初期化の結果、実際に送れる状態になったか。DSNが空なら`false`のまま。 */
let enabled = false;

/**
 * Sentryを初期化し、送れる状態かどうかを返す。**遅延初期化にしてある。**
 *
 * `SENTRY_DSN.value()`はモジュール読み込み時には解決できない — firebase-toolsは
 * デプロイ前に関数定義を読み込んで解析するが、その時点ではSecret Managerの値が
 * 渡っていないため。ハンドラの中で初めて呼ぶことでこれを避ける。
 */
const ensureInitialized = (): boolean => {
  if (initialized) {
    return enabled;
  }
  initialized = true;

  const dsn = SENTRY_DSN.value();

  if (dsn === "") {
    console.warn("SENTRY_DSNが未設定のため、Sentryへの送信を行いません");
    return false;
  }

  Sentry.init({
    dsn,
    /*
      既定の統合を入れない。`@sentry/node`の既定にはOpenTelemetryベースの自動計装が
      含まれ、`Sentry.init`の時点で`import-in-the-middle`によるモジュールフックの
      登録まで走る。この初期化が動くのは「コールドスタートしたインスタンスで最初に
      エラーが出たとき」で、**ログイン通知ではResendの5秒を使い切った直後**にあたる。
      7秒の予算に対してそこから初期化を始めるのは薄氷で、ログイン自体を落としかねない。

      **`integrations: []`では止まらない。** `@sentry/core`の`getIntegrationsToSetup`は
      配列を既定と**マージ**するため(`[...defaultIntegrations, ...userIntegrations]`)、
      空配列を渡しても既定はそのまま入る。無効化のレバーはこちらだけ。

      代償として、OS・ランタイム情報とソース行の付帯が無くなる。使うのは
      `captureException`だけなので、例外の型・メッセージ・スタックトレースは残る。
    */
    defaultIntegrations: false,
    /*
      dev/prodは同一Sentryプロジェクトを`environment`で分ける(カード[X3])。
      フロントエンドと同じく、接続先プロジェクトIDをそのまま使う
      — 接続先と表示が食い違うことが原理的に起きないため。
    */
    environment: resolveProjectId() || "unknown",
    // パフォーマンス監視は対象外。無料枠(5,000イベント/月)はエラー検知だけに使う
    tracesSampleRate: 0,
    // IPアドレスやリクエストの中身を既定で送らせない。取りこぼしは`beforeSend`が受け止める
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });

  enabled = true;
  return true;
};

/**
 * 障害を表す`HttpsError`のコード。**これ以外は制御フローとみなして送らない。**
 *
 * - `internal` — サーバー側で何かが壊れた。`signup-allowlist`がFirestoreの
 *   読み取りに失敗したときに投げる
 * - `unavailable` — 依存先へ届かなかった。gRPCの`UNAVAILABLE`の意味そのもの
 *
 * **`unavailable`を含めるのはカード[X3-4]で足した。** 当初は`internal`だけを別扱いに
 * していたが、このリポジトリで`unavailable`を投げている箇所は**全て本物の障害**だった。
 *
 * | 箇所 | 包んでいるもの |
 * |---|---|
 * | `auth/password-confirmation.ts` | Identity Platformへ接続できなかった |
 * | `contact/functions.ts` | Resendへ送れなかった / 宛先・APIキーが未設定 |
 * | `account-deletion/functions.ts` | Firestoreの再帰削除・Authユーザー削除の失敗 |
 * | `linked-providers/functions.ts` | Identity Platformの更新失敗 |
 * | `mfa-recovery/functions.ts` | Identity Platformの更新失敗・接続不可 |
 *
 * とりわけ`data-deletion-failed`(`account-deletion`)は、同じファイルのコメントが
 * 「取引が積み上がったアカウントで再帰削除が収まらないことがある」と書いているとおり
 * **まさに検知したい種類の障害**で、これが除外されたままだった。
 *
 * **`details.reason`ではなくコードで判別し続けているのは意図的。** 理由の一覧をここに
 * 持つと、新しい`reason`を足すたびに更新が要り、忘れると静かに検知漏れになる。
 * コードで足りるのは、利用者の通常操作が`invalid-argument`・`unauthenticated`・
 * `failed-precondition`・`permission-denied`・`resource-exhausted`に分かれていて、
 * 障害用の2つと混ざっていないため。**この住み分けを崩す`HttpsError`を足すときは、
 * ここも一緒に考えること。**
 */
const FAILURE_CODES: ReadonlySet<FunctionsErrorCode> = new Set<FunctionsErrorCode>([
  "internal",
  "unavailable",
]);

/**
 * 想定内の失敗かどうか。
 *
 * `HttpsError`の多くは**クライアントへ返すための制御フロー**であって障害ではない。
 * パスワード間違い(`unauthenticated`)や入力不備(`invalid-argument`)まで送ると、
 * 利用者の通常操作でSentryが埋まり、本当の障害が埋もれる。
 */
const isExpectedFailure = (error: unknown): boolean =>
  error instanceof HttpsError && !FAILURE_CODES.has(error.code);

/**
 * 同じ種類のイベントを続けて送らない時間(ミリ秒)。
 *
 * **無料枠(5,000件/月)を1つの障害で使い切らせないための歯止め**([X3-6])。
 * `sendContactMessage`(A11)は**サインイン不要で叩ける唯一のcallable**で、しかも失敗した
 * 呼び出しには実質的なレート制限がかかっていない — 宛先未設定は送信枠の確保より前で投げ、
 * 送信失敗は確保した枠を戻すため(`contact/functions.ts`)。枠を戻すのは
 * docs/screen-requirements-public.md A11 が明記した要件なので、**監視の都合で曲げない**。
 * 代わりに送る側で絞る。
 *
 * **最初の1件は必ず送る。** ここが「一定時間まったく送らない」になると、検知そのものを
 * 落とすことになり本末転倒になる。Sentryのスパイク保護がイベントを無差別に落とすのに対し、
 * こちらは種類ごとに1件目を通すので、**別種の障害が同時に起きても取りこぼさない**。
 *
 * 10分にしたのは、継続する障害ならインスタンスあたり1時間に6件前後は届き、
 * 「まだ直っていない」ことも見えるため。
 */
const DUPLICATE_SUPPRESSION_WINDOW_MS = 600_000;

/**
 * 抑制の記録を保つ上限。
 *
 * インスタンスが生きている間ずっと溜まるので、際限なく増やさない。
 * 溢れたときは**新しい種類を記録しないだけ**にして、既に覚えている種類の抑制は守る。
 * 記録できなかった種類は毎回送られる = **送る側に倒れる**。監視の記録が監視を止めては困る。
 *
 * **まるごと捨てる作りにしない。** 呼び出し元の多く(`withSentryReporting`・
 * `signup-allowlist`・`login-notification`)は**手作りしていない生の例外**をそのまま渡す。
 * メッセージに毎回変わる値が混ざる例外(gRPCの`DEADLINE_EXCEEDED`など)が続くと、
 * キーが呼び出しごとに変わって記録が埋まる。ここで全部消すと、**その巻き添えで無関係な
 * 種類の抑制まで巻き戻り、抑制が全体で無効になる**。うるさい1つの経路が効かないのは
 * このPR以前と同じだが、他を道連れにするのはこの仕組みが新しく持ち込む害になる。
 */
const MAX_SUPPRESSION_ENTRIES = 200;

/** 種類ごとの最終送信時刻(ミリ秒)。インスタンスをまたいでは共有されない。 */
const lastReportedAt = new Map<string, number>();

/** `HttpsError`の`details`に載った機械可読な失敗理由。無ければ空文字。 */
const readFailureReason = (details: unknown): string =>
  typeof details === "object" && details !== null && "reason" in details && typeof details.reason === "string"
    ? details.reason
    : "";

/**
 * `Error`ですらない値を投げられたときの記述。
 *
 * **`String()`は投げうる。** `toString`を持たない値(`Object.create(null)`)がその例で、
 * ここで投げると呼び出し元のcatchに落ち、**イベントごと送られなくなる**。
 * (`Symbol`は`String()`が特別扱いするので投げない。`\`${sym}\``なら投げる)
 */
const describeUnknown = (error: unknown): string => {
  try {
    return String(error);
  } catch {
    return typeof error;
  }
};

/**
 * イベントの「種類」を表すキー。
 *
 * **メッセージは`redactSensitiveText`を通してから使う。** UIDやメールアドレスが混ざったまま
 * だと、同じ障害が利用者ごとに別の種類として数えられ、抑制が効かなくなる
 * (`scrub.ts`がSentryへ送る直前に伏せているのと同じ値を、ここでは同一性の判定に使う)。
 *
 * **メッセージに残った可変値は種類を分ける。** `mailer.ts`の
 * 「メールを送信できませんでした (status 500)」はその一例で、ステータスコードが変われば
 * 別の種類として1件ずつ通る。**これは意図したもの** — 429(レート制限)と503(過負荷)は
 * 別の障害で、どちらも知りたい。数字まで潰すと、`scrub.ts`が「バックエンドでは数字を
 * 伏せない」理由に挙げているステータスコードという切り分け材料を、抑制の側から失う。
 *
 * **`Error`ですらない値は、すべて1つの種類に丸まる。** `String({a: 1})`も`String({b: 2})`も
 * `[object Object]`になるため。10分以内に別々のプレーンオブジェクトが投げられると、
 * 片方は送られない — **`unknown`分岐だけは「別種の障害を取りこぼさない」が成り立たない**。
 * 承知のうえで残している。`Error`でない値はSentry側でも「Non-Error exception」として
 * 扱われ元々切り分けが難しく、内容をキーにすると非有界なキーを作りかねないため
 * ([X3-7](https://trello.com/c/QkdtEE0n)が扱う問題を自分から増やすことになる)。
 *
 * 代償として、`Error`分岐の上限は「1件/10分」ではなく「ステータスの種類数/10分」になる。
 * **有限の小さな集合で頭打ちになる**ので、[X3-6]が塞いだ「1リクエストにつき1件」という
 * 無制限の増幅とは桁が違う。メッセージに**非有界な**値(件数・所要時間・タイムスタンプ)を
 * 入れると話が変わるので、そういうメッセージをここへ流さないこと。
 */
const buildSuppressionKey = (error: unknown): string => {
  if (error instanceof HttpsError) {
    return `HttpsError:${error.code}:${readFailureReason(error.details)}`;
  }

  if (error instanceof Error) {
    return `${error.name}:${redactSensitiveText(error.message)}`;
  }

  return `unknown:${redactSensitiveText(describeUnknown(error))}`;
};

/**
 * 送信したことを覚える。
 *
 * 上限に達していたら期限切れを掃除し、それでも空きが無ければ**この種類を覚えない**。
 * 覚えられなかった種類は次も送られるだけで、既に覚えている種類には影響しない。
 * フラッドが収まれば、記録は最大でも抑制窓のぶんで期限切れになって空く。
 */
const rememberReported = (key: string, now: number): void => {
  // 既に覚えている種類の更新は、空きの有無に関係なく通す(件数が増えないため)
  if (lastReportedAt.size >= MAX_SUPPRESSION_ENTRIES && !lastReportedAt.has(key)) {
    for (const [candidate, reportedAt] of lastReportedAt) {
      if (now - reportedAt >= DUPLICATE_SUPPRESSION_WINDOW_MS) {
        lastReportedAt.delete(candidate);
      }
    }

    if (lastReportedAt.size >= MAX_SUPPRESSION_ENTRIES) {
      return;
    }
  }

  lastReportedAt.set(key, now);
};

/**
 * この種類を今送ってよければキーを、抑制するなら`undefined`を返す。
 *
 * **記録はここでしない。** 実際にSentryへ渡したあとで`rememberReported`を呼ぶ。
 * 先に記録すると、`captureException`が投げた場合に「送れていない種類」を送った扱いで
 * 抑制してしまい、次の10分ぶんを黙って落とすことになる。
 *
 * 判定から記録までの間に`await`を挟まないので、同一インスタンスで並行して走る呼び出しに
 * 割り込まれることはない(Cloud Functions gen2は1インスタンスで複数リクエストを捌く)。
 */
const resolveReportKey = (error: unknown, now: number): string | undefined => {
  const key = buildSuppressionKey(error);
  const reportedAt = lastReportedAt.get(key);

  return reportedAt !== undefined && now - reportedAt < DUPLICATE_SUPPRESSION_WINDOW_MS
    ? undefined
    : key;
};

/**
 * 例外をSentryへ送る。**送信完了を待たない。**
 *
 * Blocking Functions用。`beforeUserSignedIn`・`beforeUserCreated`には7秒の予算があり、
 * ログイン通知は既にResend呼び出しで5秒を使いうる(`login-notification/mailer.ts`)。
 * ここで待つと、Sentryが新たなタイムアウト要因になってログイン自体を落としかねない
 * (カード[X3]の設計方針5)。
 *
 * 待たない以上、インスタンスが凍結されてイベントを取りこぼす可能性は残る。
 * ログイン成功を守る方を優先した結果として受け入れる。
 */
export const captureWithoutWaiting = (error: unknown): void => {
  if (isExpectedFailure(error)) {
    return;
  }

  try {
    if (!ensureInitialized()) {
      return;
    }

    // 直前に同じ種類を送っていれば黙る([X3-6])。待たない経路なのでflushの心配は無い
    const now = Date.now();
    const key = resolveReportKey(error, now);

    if (key === undefined) {
      return;
    }

    Sentry.captureException(error);
    rememberReported(key, now);
  } catch (sentryError) {
    // Sentryの都合で呼び出し元を壊さない。ここで投げると握りつぶしの意味が消える
    console.error("Sentryへの送信に失敗しました", sentryError);
  }
};

/**
 * 例外をSentryへ送り、**送信完了を待つ**。callable用。
 *
 * callableの既定タイムアウトは60秒、`deleteAccount`は300秒あるので、
 * ここで数秒使っても呼び出し全体を壊さない。
 *
 * **ここでのflushは、この呼び出しの中で`captureWithoutWaiting`が積んだイベントも一緒に
 * 押し出す。** カード[X3-5]の穴はここだった — お問い合わせ(A11)でメール送信が失敗すると
 * `mailer.ts`が`captureWithoutWaiting`でイベントを積み、`contact/functions.ts`が
 * `unavailable`の`HttpsError`を投げるが、当時は`unavailable`が「想定内」と判定されて
 * この関数が即returnし、**積まれたイベントを誰もflushしないままインスタンスが
 * 凍結されうる**状態だった。[X3-4]で`unavailable`を送信対象にしたことで、この経路も
 * flushまで進む。
 *
 * その結果、お問い合わせの送信失敗では**イベントが2件届く** — `mailer.ts`のErrorが
 * 「なぜ送れなかったか」(接続エラー・Resendのstatusコード)を、こちらの`HttpsError`が
 * 「どのcallableで起きたか」を持つ。**重複は意図したもの**で、失敗自体がまれなので
 * 無料枠(5,000件/月)を脅かさず、両方あるほうが切り分けやすい([X3-5])。
 */
const captureAndWait = async (error: unknown): Promise<void> => {
  if (isExpectedFailure(error)) {
    return;
  }

  try {
    if (!ensureInitialized()) {
      return;
    }

    /*
      直前に同じ種類を送っていればこのイベントは積まない([X3-6])。
      **ただしflushは行う。** 同じ呼び出しの中で`captureWithoutWaiting`が別の種類を
      積んでいることがあり(お問い合わせ経路の`mailer.ts`)、ここで返してしまうと
      [X3-5]で塞いだ穴がそのまま開く。積むのをやめるだけで、押し出すのはやめない。
    */
    const now = Date.now();
    const key = resolveReportKey(error, now);

    if (key !== undefined) {
      Sentry.captureException(error);
      rememberReported(key, now);
    }

    await Sentry.flush(CALLABLE_FLUSH_TIMEOUT_MS);
  } catch (sentryError) {
    console.error("Sentryへの送信に失敗しました", sentryError);
  }
};

/**
 * callableのハンドラを包み、想定外の例外をSentryへ送ってから投げ直す。
 *
 * `onCallWithSentry`から切り出してあるのは、`onCall`が返す`CallableFunction`が
 * ユニットテスト用の入口を型として公開していないため(`login-notification`が
 * `notifyLogin`を切り出しているのと同じ事情)。包む処理そのものはここを直接テストする。
 */
export const withSentryReporting =
  <Result>(handler: (request: CallableRequest) => Promise<Result>) =>
  async (request: CallableRequest): Promise<Result> => {
    try {
      return await handler(request);
    } catch (error) {
      await captureAndWait(error);
      throw error;
    }
  };

/**
 * `onCall`の差し替え。想定外の例外をSentryへ送ってから投げ直す([X3])。
 *
 * **`onCall`ではなくこちらを使う。** 呼び出し側の変更を関数名だけに留めるための形で、
 * ハンドラを`withSentry(...)`で包む書き方にすると閉じ括弧まで動かすことになり、
 * 7箇所ぶんの差分が読みにくくなる。
 *
 * 例外を投げ直すのは、クライアントへ返すエラーを変えないため。Sentryの有無で
 * 画面の見え方が変わってはいけない。
 *
 * `options`を必須にしてあるのは、**どの関数も`SENTRY_DSN`を`secrets`に要る**ため
 * (`secrets.ts`)。引数なしの形を残すと、シークレットの結び付けを忘れた関数が
 * 「送っているつもりで送れていない」状態で通ってしまう。
 *
 * **ストリーミング(`onCall`の第2引数`response`)には対応していない。** 現状の7つの
 * callableはいずれも使っていないため落としてある。必要になったらここに足す — 型が
 * 通らなくなるので、気づかないまま使えなくなることはない。
 */
export const onCallWithSentry = <Result>(
  options: CallableOptions,
  handler: (request: CallableRequest) => Promise<Result>,
) => onCall(options, withSentryReporting(handler));

/** テスト用。モジュールに溜まった初期化状態を戻す。 */
export const resetSentryForTest = (): void => {
  initialized = false;
  enabled = false;
  lastReportedAt.clear();
};
