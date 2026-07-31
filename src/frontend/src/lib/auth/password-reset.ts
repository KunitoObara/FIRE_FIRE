import { FirebaseError } from "firebase/app";
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";

import { toActionCodeFailureReason } from "@/lib/auth/action-code";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

/**
 * 送信されなかったが、アカウントの存在有無を伏せるため成功として扱うエラーコード
 * (docs/screen-requirements-auth.md A6)。
 *
 * `auth/user-not-found`は未登録のメールアドレス、`auth/invalid-email`は送信前にzodで
 * 形式を検証済みのため通常は起きないが、Firebase側の判定が画面と食い違ったときに
 * 「このアドレスは弾かれた」と分かる表示になるのを防ぐため同じ扱いにする。
 *
 * なおIdentity Platformのメール列挙保護が有効な場合、未登録のアドレスでは
 * そもそもエラーにならず成功として返る。どちらの挙動でも表示を揃えるための備え。
 */
const CONCEALED_ERROR_CODES = ["auth/user-not-found", "auth/invalid-email"];

const isConcealedError = (error: unknown): boolean =>
  error instanceof FirebaseError && CONCEALED_ERROR_CODES.includes(error.code);

const toFailureReason = (error: unknown): PasswordResetFailureReason => {
  // 設定不足は通信エラーと区別し、対処法を画面に出せるようにする
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    case "auth/too-many-requests":
      return "too-many-requests";
    // ローカル開発ではAuthエミュレータ未起動が主な原因になる
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

/**
 * パスワード再設定用のメールを送信する(A6「リセットメールを送信する」)。
 *
 * Firebase Authentication標準のリセットメール機能を使う
 * (docs/auth-login-requirements.md 3.5)。リンク先の再設定画面(A7)は別カードで扱うため、
 * ここでは`actionCodeSettings`を渡さずFirebase標準のアクションハンドラに委ねる。
 *
 * 未登録のメールアドレスや、Googleのみで作成されたパスワード未設定のアカウントでは
 * メールは実際には送信されないが、戻り値は成功と区別しない。区別すると、そのアドレスが
 * 登録されているかどうかを外部から判定できてしまうため(A6の仕様)。
 * エミュレータではリセットリンクがエミュレータ側の端末に出力され、メールは飛ばない。
 */
export const requestPasswordReset = async (email: string): Promise<PasswordResetResult> => {
  try {
    // 設定値が不足していると`FirebaseConfigurationError`を投げる。これも
    // `configuration-error`として画面に返したいので、取得はtryの中に置く
    const auth = getFirebaseAuth();

    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (error) {
    if (isConcealedError(error)) {
      // 存在の有無を伏せる意図に対してコンソールが抜け道に見えるため、ログにも残さない
      return { ok: true };
    }

    const reason = toFailureReason(error);
    if (reason === "unknown") {
      console.error("パスワード再設定用のメールを送信できませんでした", error);
    }
    return { ok: false, reason };
  }
};

/**
 * リセットメールのリンクに含まれるワンタイムコードを検証する(A7の初期表示)。
 *
 * 入力欄を出す前にリンクの有効性を確かめ、期限切れ・使用済みのリンクで
 * パスワードを入力させてから失敗させることのないようにする。
 * 成功時に返るメールアドレスは、変更対象のアカウントの確認表示に使う。
 */
export const verifyPasswordResetLink = async (
  oobCode: string,
): Promise<PasswordResetCodeResult> => {
  try {
    // 設定値が不足していると`FirebaseConfigurationError`を投げる。これも
    // `configuration-error`として画面に返したいので、取得はtryの中に置く
    const auth = getFirebaseAuth();

    const email = await verifyPasswordResetCode(auth, oobCode);
    return { ok: true, email };
  } catch (error) {
    const reason = toActionCodeFailureReason(error);
    if (reason === "unknown") {
      console.error("パスワード再設定リンクを検証できませんでした", error);
    }
    return { ok: false, reason };
  }
};

/**
 * 新しいパスワードを確定する(A7「パスワードを再設定する」)。
 *
 * パスワードポリシーの正となる強制はIdentity Platform側にあるため
 * (docs/auth-login-requirements.md 3.2)、画面側の検証を通っていても
 * `password-policy-violation`が返りうる。
 *
 * 成功してもサインイン状態にはならない。A4でログインし直してもらう仕様のため
 * (docs/screen-requirements-auth.md A7)、ここではサインインを試みない。
 */
export const completePasswordReset = async (
  oobCode: string,
  newPassword: string,
): Promise<PasswordResetConfirmResult> => {
  try {
    const auth = getFirebaseAuth();

    await confirmPasswordReset(auth, oobCode, newPassword);
    return { ok: true };
  } catch (error) {
    // Identity Platform側のパスワードポリシー違反だけは、リンクの状態ではなく
    // 入力値の問題としてパスワード欄に返す必要があるため先に判定する
    if (
      error instanceof FirebaseError &&
      (error.code === "auth/weak-password" ||
        error.code === "auth/password-does-not-meet-requirements")
    ) {
      return { ok: false, reason: "password-policy-violation" };
    }

    const reason = toActionCodeFailureReason(error);
    if (reason === "unknown") {
      console.error("パスワードを再設定できませんでした", error);
    }
    return { ok: false, reason };
  }
};
