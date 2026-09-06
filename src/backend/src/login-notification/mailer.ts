/**
 * Resend経由のメール送信(docs/auth-login-requirements.md 3.6の「外部メール送信サービス」)。
 *
 * サービスの選定理由は src/backend/docs/TECH_STACK.md 4章にある。HTTP APIだけで送れるため
 * SMTPクライアント(nodemailer等)の依存を増やさず、`fetch`だけで完結する。
 *
 * 呼び出し元はログインを止めないため(`functions.ts`)、この関数は例外を投げず結果を返す。
 * **例外を投げない以上、失敗の検知はここでSentryへ送るしかない**([X3])。
 */

import { captureWithoutWaiting } from "../sentry/report";

/** 送信結果。失敗の理由は切り分け用にログへ残し、呼び出し元は成否だけ見る */
export type MailDeliveryResult =
  | { status: "sent" }
  /** APIキーが未設定、または明らかに形式が違って送信を試みなかった */
  | { status: "not-configured" }
  | { status: "failed" };

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * ResendのAPIキーの接頭辞。
 *
 * 発行されるキーは必ず`re_`で始まる(docs/ci-cd-setup.md 13.1)。**キーの形式に依存する
 * 判定をあえて置いている** — [X26]では`RESEND_API_KEY`にGoogleのAPIキーとおぼしき別の値が
 * 登録されており、dev/prodとも一通も届かないまま1か月気づけなかった。401だけでは
 * キーが失効したのか別物を貼ったのか区別が付かないが、接頭辞が違えば**登録した値
 * そのものが誤り**だと名指しできる。
 *
 * Resendが接頭辞を変えた場合はここも変える。そのときは送信が止まるが、下の
 * `captureWithoutWaiting`が理由を名指しするので、原因の分からない不達にはならない。
 */
const API_KEY_PREFIX = "re_";

/**
 * 送信元アドレス。
 *
 * Resendが用意する共有ドメインを使う。DNS設定なしで送れる代わりに、宛先はResendアカウントの
 * 登録メールアドレスに限られる。利用者が開発者1人の現状(CLAUDE.md「Single-user」)では
 * 制約にならないため、独自ドメインの検証は行っていない。独自ドメインへ移すときは、この定数と
 * docs/ci-cd-setup.md の手順を差し替える。
 */
const FROM_ADDRESS = "FIRE-FIRE <onboarding@resend.dev>";

/**
 * 送信を打ち切るまでの時間。
 *
 * Blocking Functionsは7秒で打ち切られ、超えるとログインそのものが失敗する
 * (https://firebase.google.com/docs/auth/extend-with-blocking-functions)。
 * 上流が応答しないケースでもハンドラが自力で戻れるよう、これより短く切る。
 */
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * メールを1通送る。
 *
 * `apiKey`が空のときは送信を試みない。エミュレータではSecret Managerの値が解決されず
 * 空文字になるため、ローカル開発でシークレットの設定を要らなくする。
 *
 * **`re_`で始まらない値も送信を試みない。** 形式が違えばResendは401しか返さないので、
 * Blocking Functionsの7秒の予算のうち5秒を確実に失敗する往復へ使う理由が無い。
 */
export const sendMail = async (
  apiKey: string,
  message: MailMessage,
): Promise<MailDeliveryResult> => {
  if (apiKey === "") {
    /*
      **本番でここに来たら設定漏れなので、Sentryへ送る。** シークレットが未登録なら
      デプロイ自体が落ちるが、「登録済みだが値が空」は素通りし、メールが恒久的に
      送れないまま誰も気づけない — 本カードが無くそうとしている状態そのもの。

      ローカルとエミュレータではSecret Managerの値が解決されず必ずここへ来るが、
      `SENTRY_DSN`も同時に空になるため`captureWithoutWaiting`は何も送らない
      (`report.ts`の`ensureInitialized`)。ノイズにはならない。
    */
    captureWithoutWaiting(new Error("APIキーが未設定のため、メールを送信しませんでした"));
    return { status: "not-configured" };
  }

  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    /*
      **未設定は弾くのに誤った値は素通りする、という非対称を埋める分岐**([X26])。
      値そのものはログにもSentryにも出さない — 誤って登録されたのが別サービスの
      有効なキーである可能性があるため、長さも接頭辞も含めて残さない。
    */
    captureWithoutWaiting(new Error("APIキーの形式が不正なため、メールを送信しませんでした"));
    return { status: "not-configured" };
  }

  let response: Response;

  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("メール送信サービスへ接続できませんでした", error);
    captureWithoutWaiting(error);
    return { status: "failed" };
  }

  if (!response.ok) {
    // 本文にはメールアドレスが含まれうるためステータスコードだけ残す
    console.error("メールを送信できませんでした", response.status);
    /*
      **戻り値で失敗を返す経路なので、呼び出し側のtry/catchでは拾えない。**
      ここで送らないと、カード[X3]が検知したかった「握りつぶされた送信失敗」が
      そのまま漏れる — ログイン通知は呼び出し元が握り潰すため、例外として上がらない。
      Errorに包むのは、ステータスコードだけでは何が起きたか追えないから。

      お問い合わせ(A11)は`unavailable`のHttpsErrorに変換され、[X3-4]以降はそちらも
      Sentryへ送られる。**同じ失敗でイベントが2件になるのは承知のうえ** — こちらだけが
      statusコードを持つため([X3-5]、`sentry/report.ts`の`captureAndWait`)。
      連投しても増え続けはしない。同じ種類は10分に1件へ絞られる([X3-6])。
      **ただしステータスコードは種類の一部になる。** 429と500は別の障害なので別々に
      1件ずつ通る — 上限はResendが返しうるステータスの数で頭打ちになる。
    */
    captureWithoutWaiting(new Error(`メールを送信できませんでした (status ${response.status})`));
    return { status: "failed" };
  }

  return { status: "sent" };
};
