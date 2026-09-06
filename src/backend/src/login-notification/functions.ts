/**
 * ログイン通知(docs/auth-login-requirements.md 3.6 / 3.8)。
 *
 * Identity PlatformのBlocking Functions(ログイン後トリガー)で毎回のログイン成功を受け、
 * 登録済みメールアドレスへ通知を送る。Firebase Authentication標準ではカスタム通知メールを
 * 送れないため、この構成になっている(3.6)。
 *
 * `beforeUserSignedIn`は**第2要素の検証が済んだあと**に発火する
 * (https://firebase.google.com/docs/auth/extend-with-blocking-functions)。
 * 本アプリは2FAを全ユーザー必須にしているので(3.3)、第1要素だけ通って2FAで止まった試行は
 * ここに来ない = 「ログイン成功時」の通知として過不足がない。
 *
 * ログアウトは対象外。Blocking Functionsはサインイン時にしか発火せず、相当するフックが無い(3.9)。
 *
 * **サインアップ直後の初回サインインでも送る**。アカウント作成時は`beforeUserCreated`に続いて
 * こちらも発火するため、2FAの登録(A3)を終える前に1通届き、Firebaseの確認メールと合わせて
 * 2通になる。それでも抑止しないのは、セッションが成立している以上「ログイン成功」であり、
 * 3.6の「毎回」に例外を作らないため。自分のメールアドレスで勝手にアカウントを作られた場合に
 * 気づける利点もある。
 */

import { defineSecret } from "firebase-functions/params";
import { beforeUserSignedIn } from "firebase-functions/identity";

import { resolveProjectId } from "../project-id";
import { captureWithoutWaiting } from "../sentry/report";
import { SENTRY_DSN } from "../sentry/secrets";
import { resolveSignInMethodLabel } from "./login-context";
import { sendMail } from "./mailer";
import { buildLoginNotificationMail } from "./message";

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * ResendのAPIキー。発行と登録の手順は docs/ci-cd-setup.md を参照。
 *
 * `IDENTITY_PLATFORM_WEB_API_KEY`と同じくSecret Managerに置く。firebase-toolsは
 * パラメータを`.env`系ファイルからしか解決せず(リポジトリでは除外している)、
 * CIの環境変数を見ないため。
 */
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

/**
 * ログイン1回ぶんの通知を送る。
 *
 * **失敗してもログインを止めない**。Blocking Functionsで例外を投げるとサインインが失敗するため、
 * メール事業者の一時障害やタイムアウトがそのままアプリの停止になってしまう。通知が届かない
 * ログインが起こりうることは承知のうえで受容し、失敗はログに残して切り分けられるようにする。
 *
 * イベントのハンドラ本体を関数として切り出してあるのは、`beforeUserSignedIn`が返す
 * `BlockingFunction`がユニットテスト用の入口を型として公開していないため。
 */
export const notifyLogin = async (event: AuthBlockingEvent): Promise<void> => {
  const email = event.data?.email;

  if (email === undefined || email === "") {
    // メールアドレスを持たないアカウント(電話番号のみ等)。本アプリでは作られない想定だが、
    // 送り先が無い以上ここで終える
    console.warn("メールアドレスが無いため、ログイン通知を送信しませんでした");
    return;
  }

  const signedInAt = new Date(event.timestamp);

  const mail = buildLoginNotificationMail({
    // タイムスタンプを解釈できない場合は現在時刻に落とす。通知の主目的は「いつ入られたか」を
    // 伝えることなので、書式の想定違いで空欄にするより処理時刻を示すほうが役に立つ
    signedInAt: Number.isNaN(signedInAt.getTime()) ? new Date() : signedInAt,
    signInMethod: resolveSignInMethodLabel(event),
    ipAddress: event.ipAddress ?? "",
    userAgent: event.userAgent ?? "",
    /*
      実行中のプロジェクトID。開発環境からの通知を見分けるために本文へ載せる
      (`message.ts`が`[dev]`を付ける)。読めない場合は本番以外として扱われる。
      実際に本番で`[dev]`が付かないことは docs/ci-cd-setup.md 13.3 で確認する。
    */
    projectId: resolveProjectId(),
  });

  const result = await sendMail(RESEND_API_KEY.value(), {
    to: email,
    subject: mail.subject,
    text: mail.text,
  });

  if (result.status === "not-configured") {
    console.warn("RESEND_API_KEYが未設定、または形式が不正なため、ログイン通知を送信しませんでした");
  }
};

/**
 * ログイン成功時に通知メールを送るBlocking Function。
 *
 * ハンドラは何も返さない(ユーザーレコードもセッションのクレームも書き換えない)。
 * 例外も投げないため、このトリガーがログインを拒否することはない。
 */
export const sendLoginNotification = beforeUserSignedIn(
  { secrets: [RESEND_API_KEY, SENTRY_DSN] },
  async (event) => {
    try {
      await notifyLogin(event);
    } catch (error) {
      // `notifyLogin`は自前で握り潰す作りだが、想定外の例外でログインが落ちないよう二重に受ける
      console.error("ログイン通知の送信に失敗しました", error);
      /*
        握り潰した失敗をここでSentryへ送る([X3])。ログに残すだけでは
        能動的に見に行かない限り気づけず、それがこのカードの動機そのもの。
        送信完了は待たない — 7秒の予算のうちResendが既に5秒を使いうるため。
      */
      captureWithoutWaiting(error);
    }
  },
);
