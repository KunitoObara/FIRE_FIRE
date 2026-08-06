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
 */

import { defineSecret } from "firebase-functions/params";
import { beforeUserSignedIn } from "firebase-functions/identity";

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

/** 実行中のFirebaseプロジェクトID。開発環境からの通知を見分けるために本文へ載せる */
const currentProjectId = (): string =>
  process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? "";

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
    projectId: currentProjectId(),
  });

  const result = await sendMail(RESEND_API_KEY.value(), {
    to: email,
    subject: mail.subject,
    text: mail.text,
  });

  if (result.status === "not-configured") {
    console.warn("RESEND_API_KEYが未設定のため、ログイン通知を送信しませんでした");
  }
};

/**
 * ログイン成功時に通知メールを送るBlocking Function。
 *
 * ハンドラは何も返さない(ユーザーレコードもセッションのクレームも書き換えない)。
 * 例外も投げないため、このトリガーがログインを拒否することはない。
 */
export const sendLoginNotification = beforeUserSignedIn(
  { secrets: [RESEND_API_KEY] },
  async (event) => {
    try {
      await notifyLogin(event);
    } catch (error) {
      // `notifyLogin`は自前で握り潰す作りだが、想定外の例外でログインが落ちないよう二重に受ける
      console.error("ログイン通知の送信に失敗しました", error);
    }
  },
);
