import { reload } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { RESET_MFA_ENROLLMENT_FUNCTION } from "@/constants/firebase";
import { toCallableFailureReason } from "@/lib/auth/callable-error";
import { getFirebaseAuth, getFirebaseFunctions } from "@/lib/firebase/client";

/**
 * 2FA(TOTP)の再設定(docs/screen-requirements-account.md B10)。
 *
 * B10からは「解除」だけを行い、登録し直しはA3に任せる。解除された時点でログイン後画面の
 * ガードが2FA未登録と判定してA3へ送るため(`src/lib/auth/app-access.ts`)、
 * 画面側は解除の成功を受けてIDトークンを取り直すだけでよい。
 *
 * 解除はクライアントSDKの`multiFactor().unenroll()`ではなくCloud Functionsで行う。
 * 2FA登録済みのユーザーの再認証はパスワードだけでは完了せず認証アプリの確認コードまで
 * 要求されるため、本人確認をパスワードの再入力とする要件を満たせないため。
 */

/** バックエンドの`details.reason`として受け付ける値 */
const RESET_FAILURE_REASONS: readonly MfaResetFailureReason[] = [
  "signed-out",
  "mfa-not-enrolled",
  "password-required",
  "invalid-credential",
  "too-many-requests",
  "unenroll-failed",
];

/**
 * 解除の結果をブラウザ側が持つユーザー情報へ反映する。
 *
 * 解除はサーバー側(Admin SDK)で行うため、`currentUser`の登録済み2要素目は古いままになる。
 * 取り直さないとガードが「2FA登録済み」と判定し続け、A3へ進めない。
 *
 * 失敗しても解除自体は済んでいるため呼び出し元は成功として扱う。A3は表示時に自分でも
 * ユーザー情報を取り直す(`startTotpEnrollment`)ので、ここで漏れても行き止まりにはならない。
 */
const refreshEnrolledFactors = async (): Promise<void> => {
  try {
    const user = getFirebaseAuth().currentUser;

    if (user !== null) {
      await reload(user);
    }
  } catch (error) {
    console.error("2段階認証の解除後にユーザー情報を取り直せませんでした", error);
  }
};

/**
 * パスワードで本人確認したうえで、現在の2FA登録を解除する。
 *
 * 成功しても解除だけで、リカバリーコードも同時に破棄される。呼び出し側は続けてA3へ進める。
 */
export const resetMfaEnrollment = async (password: string): Promise<MfaResetResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), RESET_MFA_ENROLLMENT_FUNCTION);
    await callable({ password });
    await refreshEnrolledFactors();

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        RESET_FAILURE_REASONS,
        "2段階認証を解除できませんでした",
      ),
    };
  }
};
