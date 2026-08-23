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
  /** APIキーが未設定で送信を試みなかった(ローカルのエミュレータ等) */
  | { status: "not-configured" }
  | { status: "failed" };

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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
    */
    captureWithoutWaiting(new Error(`メールを送信できませんでした (status ${response.status})`));
    return { status: "failed" };
  }

  return { status: "sent" };
};
