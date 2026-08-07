import { HttpsError } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";

import { verifyPassword } from "./verify-password";

import type { UserRecord } from "firebase-admin/auth";

/**
 * サインイン済みの呼び出しに対する、パスワードの再入力による本人確認(B10)。
 *
 * 後戻りできない操作 — 2FAの再設定、リカバリーコードの再発行、パスワードでのログインの解除 —
 * はどれも、セッションを乗っ取られた状態で実行されると正規の利用者から復旧手段だけを奪う。
 * IDトークンだけでは「いま操作しているのが本人か」を確かめられないため、
 * 実行前にパスワードをもう一度求める(docs/screen-requirements-account.md B10)。
 *
 * クライアントSDKの`reauthenticateWithCredential`は使えない。2FA登録済みのユーザーでは
 * パスワードだけでは再認証が完了せず認証アプリの確認コードまで要求されるため、
 * 「パスワードの再入力」という要件を満たせない。
 */

/**
 * Identity PlatformのWeb APIキー。パスワードの再検証(`verify-password.ts`)に使う。
 *
 * 公開値ではあるが、CIからの非対話デプロイでも確実に解決できる置き場が要るためSecret Managerに置く
 * (`.env`系ファイルはリポジトリで除外している)。設定手順は docs/ci-cd-setup.md を参照。
 * Authエミュレータに向いている間はダミーキーで動くため、ローカル開発では未設定でよい。
 *
 * 定義をこのモジュールに1つだけ置き、使う側は import する。`defineSecret`を呼んだ数だけ
 * デプロイ時のマニフェストに宣言が積まれるため、同じ名前を複数の場所で定義しない。
 */
export const IDENTITY_PLATFORM_WEB_API_KEY = defineSecret("IDENTITY_PLATFORM_WEB_API_KEY");

/**
 * 本人確認用のパスワードを載せた呼び出しの入力。
 *
 * A3(リカバリーコードの初回発行)はパスワードを送らないため任意にしてある。要否は入力の形ではなく
 * サーバー側の状態で決め、足りなければ`password-required`として返す。
 */
export const passwordConfirmationSchema = z.object({ password: z.string().min(1).optional() });

/** `HttpsError`に載せる`code`のうち、本人確認まわりで使うもの */
export type CallableFailureCode =
  | "unauthenticated"
  | "failed-precondition"
  | "permission-denied"
  | "unavailable";

/**
 * 画面が出し分けに使う機械可読な失敗理由を`details`に載せた`HttpsError`を作る。
 *
 * `HttpsError`のメッセージは画面にそのまま出さないため、理由は`details.reason`で渡す
 * (フロントエンド側の読み取りは`src/frontend/src/lib/auth/callable-error.ts`)。
 */
export const callableFailure = (
  code: CallableFailureCode,
  reason: string,
  message: string,
): HttpsError => new HttpsError(code, message, { reason });

/** 本人確認そのものが通らなかった理由。呼び出し元の理由の型はこれを含む必要がある */
export type PasswordConfirmationFailureReason =
  /** 本人確認が要る操作なのにパスワードが送られてこなかった */
  | "password-required"
  | "invalid-credential"
  | "too-many-requests"
  | "unavailable";

/**
 * パスワードを再検証し、通らなければ`HttpsError`を投げる。
 *
 * 2FA登録済みのアカウントではサインインが完了せず`mfa-required`が返るが、
 * ここで確かめたいのは「パスワードが正しいこと」だけなので`signed-in`と同じ扱いにする。
 *
 * `user.email`が無いアカウントはパスワードで確認しようがないため、資格情報の誤りと同じ扱いにする。
 * 連携アカウント管理(B10)ではパスワードの解除を許しており、Googleのみのアカウントは
 * この本人確認を通せない = 2FAの再設定もリカバリーコードの発行もできない状態になる。これは
 * 承知のうえで、B10の解除確認ダイアログが実行前にその旨を伝える
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 */
export const verifyPasswordOrThrow = async (
  user: UserRecord,
  password: string | undefined,
): Promise<void> => {
  if (password === undefined) {
    throw callableFailure("failed-precondition", "password-required", "パスワードの入力が必要です");
  }

  const verification =
    user.email === undefined
      ? ({ status: "invalid-credential" } as const)
      : await verifyPassword(IDENTITY_PLATFORM_WEB_API_KEY.value(), user.email, password);

  switch (verification.status) {
    case "mfa-required":
    case "signed-in":
      return;
    case "invalid-credential":
      throw callableFailure(
        "permission-denied",
        "invalid-credential",
        "パスワードが正しくありません",
      );
    case "too-many-requests":
      throw callableFailure("permission-denied", "too-many-requests", "試行回数が多すぎます");
    default:
      throw callableFailure("unavailable", "unavailable", "認証基盤に接続できませんでした");
  }
};
