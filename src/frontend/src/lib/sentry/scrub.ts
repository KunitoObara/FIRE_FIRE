/**
 * Sentryへ送るイベント・ログから個人情報と金銭情報を落とす([X3])。
 *
 * 本アプリは個人の資産・収支データを扱い、リポジトリも公開されている(CLAUDE.md)。
 * Sentryは外部サービスなので、「利用者を特定できる値」と「金額そのもの」は
 * 送らないことを既定にする。`sendDefaultPii: false`だけでは足りない
 * — 例外メッセージやログの引数には、SDKの与り知らないところで
 * メールアドレスや残高が混ざりうるため。
 *
 * 方針は「残すものを選ぶ」ではなく「疑わしいものを落とす」。
 * デバッグに効く情報(例外の型・スタックトレース・発生箇所)は残しつつ、
 * 任意のアプリ由来ペイロード(`request.data`・`extra`・パンくずの`data`)は
 * 中身を検査せず丸ごと捨てる。個々の値を見て判断すると、
 * 新しい画面が増えたときに漏れる側に倒れる。
 */

import type { ErrorEvent, Log } from "@sentry/nextjs";

/** 落とした値の跡地に残す目印。消えたのか元々無かったのかを区別できるようにする。 */
export const REDACTED = "[redacted]";

/**
 * メールアドレスらしき並び。
 * 利用者の識別子であり、A11のお問い合わせやA1のサインアップの
 * エラーメッセージに乗りうる。
 */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Firestoreのドキュメントパスに現れるUID(`users/xxxx`)。
 * 単独の英数字列まで対象にすると変数名やハッシュまで潰してしまうため、
 * `users/`が前置きされている場合だけを狙う。
 */
const USER_DOCUMENT_PATH_PATTERN = /(users\/)[A-Za-z0-9_-]{6,}/g;

/** SDKが自分で付ける属性の接頭辞(リリース・環境・SDK名など)。 */
const SDK_ATTRIBUTE_PREFIX = "sentry.";

/**
 * `sentry.`で始まるが、中身はアプリ由来という属性の接頭辞。
 *
 * consoleロギング統合は`console.error(固定メッセージ, error)`の**引数そのもの**を
 * `sentry.message.parameter.N`へ、組み立てたテンプレートを`sentry.message.template`へ
 * 入れる(`@sentry/core`の`createConsoleTemplateAttributes`)。
 *
 * 接頭辞だけを見てSDK由来と扱うと、引数に載った残高がそのまま素通りする。
 * このアプリの`console.error`はほぼ全てが`(固定メッセージ, error)`の形なので、
 * ここを開けたままにするとスクラブ全体が意味を失う。
 */
const APP_ORIGIN_ATTRIBUTE_PREFIX = "sentry.message.";

/**
 * 金額らしい数字の並びと、そこから除外する日付・時刻([X3-1])。
 *
 * 1つの正規表現にまとめてあるのは、**先に日付・時刻を食わせる**ため。
 * 別々に走らせると、`2026-08-22`の`2026`が金額側の「4桁以上」に先に当たって
 * 日付が壊れる。選択肢は左から順に試されるので、日付・時刻を先頭に置く。
 *
 * **日の部分は任意にしてある。** このアプリは`yyyy-MM`(年月のみ)も実データとして
 * 使う — B11の発生年月(`DEBT_ORIGINATED_ON_PATTERN`)とB7の取得年月
 * (`REAL_ESTATE_ACQUIRED_ON_PATTERN`)がどちらもこの形でFirestoreに入る。
 * `yyyy-MM-dd`だけを守ると、`2026-08`が`[redacted]-08`になって
 * 「いつ」を守るはずの仕組みが、まさにその日付フィールドで年を潰す。
 *
 * 金額側は2通り。カンマ区切り(`1,234,567`)と、区切りの無い4桁以上(`8500`)。
 * 4桁で切るのは、このアプリの金額が1,000以上にほぼ収まる一方、
 * 行番号(2桁)・ステータスコード(3桁)がその下に収まるため。
 */
const NUMERIC_PATTERN =
  /(\d{4}-\d{2}(?:-\d{2})?|\d{2}:\d{2}(?::\d{2})?)|\d{1,3}(?:,\d{3})+|\d{4,}/g;

/**
 * 金額らしい数字を伏せる。日付・時刻はそのまま残す。
 *
 * 日付・時刻だけを捕捉グループにしてあり、そこが埋まっていれば
 * 「残す側に当たった」と判定できる。判定用の正規表現を別に持つと、
 * 2つの定義がずれたときに気づけない。
 */
const redactAmountLikeNumbers = (value: string): string =>
  value.replace(NUMERIC_PATTERN, (match, dateOrTime: string | undefined) =>
    dateOrTime === undefined ? REDACTED : match,
  );

/**
 * 文字列から利用者を特定できる部分と、金額らしい数字を伏せる。
 *
 * **順序に意味がある。** UIDを先に潰さないと、`users/aBcD1234567890`の
 * 数字部分だけが先に`[redacted]`へ変わり、残った`users/aBcD`が
 * UIDのパターン(6文字以上)に当たらなくなって、UIDの頭が素通りする。
 *
 * 数字を落とすのは[X3-1]で入れた。属性側(`scrubLogAttributes`)は元から
 * 数値を型ごと落としており、本文側だけが素通りする非対称が残っていた
 * — PR #218のレビューで指摘された点で、Firestoreは保存を拒否した値を
 * エラー文へ埋め込む(`valueDescription`が数値を`"" + e`、20文字以下の
 * 文字列を`JSON.stringify`で埋める)ため、経路としては実在する。
 *
 * 巻き添えは承知のうえで受け入れる。日付・時刻だけは`NUMERIC_PATTERN`で
 * 守るが、ビルドIDやポート番号は潰れる。金額が一つ漏れる方が高くつく。
 */
export const redactSensitiveText = (value: string): string =>
  redactAmountLikeNumbers(
    value.replace(EMAIL_PATTERN, REDACTED).replace(USER_DOCUMENT_PATH_PATTERN, `$1${REDACTED}`),
  );

/**
 * URLからクエリ文字列とフラグメントを落とし、パス部分だけにする。
 * 画面遷移のパラメータには対象月や物件IDが乗るため、パス以外は残さない。
 * 相対URLも渡されうるので`new URL()`は使わない(絶対URLでないと例外になる)。
 */
export const stripUrlParameters = (url: string): string =>
  redactSensitiveText(url.split(/[?#]/, 1)[0] ?? "");

type SentryRequest = NonNullable<ErrorEvent["request"]>;
type SentryBreadcrumb = NonNullable<ErrorEvent["breadcrumbs"]>[number];

/**
 * リクエスト情報を「どこを叩いたか」だけに削る。
 * ボディ・クエリ・Cookie・ヘッダーはいずれも認証情報や入力値の器なので残さない。
 */
const scrubRequest = (request: SentryRequest): SentryRequest => ({
  method: request.method,
  url: request.url === undefined ? undefined : stripUrlParameters(request.url),
});

/**
 * パンくずは「何が起きたか」の並びだけを残し、付随データは捨てる。
 * fetchのパンくずには送信ボディが、UIのパンくずには入力値が入りうる。
 */
const scrubBreadcrumb = (breadcrumb: SentryBreadcrumb): SentryBreadcrumb => ({
  type: breadcrumb.type,
  level: breadcrumb.level,
  category: breadcrumb.category,
  timestamp: breadcrumb.timestamp,
  message: breadcrumb.message === undefined ? undefined : redactSensitiveText(breadcrumb.message),
});

/**
 * `Sentry.init`の`beforeSend`に渡す。イベントを送信直前に削る。
 *
 * `user`を丸ごと落とすのは、`sendDefaultPii: false`でもIPアドレスや
 * `id`(=UID)が入りうるため。単一ユーザー運用(要件定義書2章)なので、
 * 誰のエラーかを区別する必要がそもそも無い。
 */
export const scrubEvent = (event: ErrorEvent): ErrorEvent => ({
  ...event,
  user: undefined,
  extra: undefined,
  message: event.message === undefined ? undefined : redactSensitiveText(event.message),
  request: event.request === undefined ? undefined : scrubRequest(event.request),
  breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
  exception:
    event.exception === undefined
      ? undefined
      : {
          ...event.exception,
          values: event.exception.values?.map((value) => ({
            ...value,
            value: value.value === undefined ? undefined : redactSensitiveText(value.value),
          })),
        },
});

/**
 * アプリ由来の属性値を削る。文字列は伏せ、真偽値は残し、それ以外の型は値ごと落とす。
 *
 * 数値を落とすのは、このアプリで数値といえば残高・収支・ローン残高だから。
 * ステータスコードや件数も巻き添えになるが、金額が一つ漏れる方が高くつく。
 * オブジェクト(`console.error`の第2引数に来るErrorなど)も丸ごと落とす
 * — 中を歩いて判断する形にすると、新しい形の値が来たときに漏れる側へ倒れる。
 */
const scrubAttributeValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (typeof value === "boolean") {
    return value;
  }
  return REDACTED;
};

/**
 * ログの属性を削る。SDK自身の属性(リリース・環境など)だけを残し、
 * それ以外はアプリ由来として削る。
 *
 * `sentry.`で始まるかどうかだけでは判定できない。`sentry.message.*`は
 * 接頭辞こそSDKのものだが、中身は`console.error`へ渡された引数そのもの
 * (`APP_ORIGIN_ATTRIBUTE_PREFIX`のコメントを参照)。
 */
const scrubLogAttributes = (attributes: Log["attributes"]): Log["attributes"] => {
  if (attributes === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => {
      const isSdkOwnAttribute =
        key.startsWith(SDK_ATTRIBUTE_PREFIX) && !key.startsWith(APP_ORIGIN_ATTRIBUTE_PREFIX);

      return [key, isSdkOwnAttribute ? value : scrubAttributeValue(value)];
    }),
  );
};

/**
 * `Sentry.init`の`beforeSendLog`に渡す。
 * `message`はテンプレート文字列型(`ParameterizedString`)だが、
 * 実体はただの文字列なので置換してから型を戻す。
 */
export const scrubLog = (log: Log): Log => ({
  ...log,
  message: redactSensitiveText(log.message) as Log["message"],
  attributes: scrubLogAttributes(log.attributes),
});
