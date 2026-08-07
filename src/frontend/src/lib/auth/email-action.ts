import { applyActionCode } from "firebase/auth";

import { toActionCodeFailureReason } from "@/lib/auth/action-code";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * メールアドレス確認リンク(`mode=verifyEmail`)を適用する。
 *
 * A2はこの画面ではなく元のタブ側でポーリングして確認完了を検知しA3へ進むため
 * (`src/components/auth/VerifyEmailNotice.tsx`)、ここでは確認を適用するだけでよい。
 * リンクは別のブラウザ・別の端末で開かれうるので、サインイン状態は前提にしない。
 */
export const applyEmailVerification = async (
  oobCode: string,
): Promise<EmailVerificationApplyResult> => {
  try {
    // 設定値が不足していると`FirebaseConfigurationError`を投げる。これも
    // `configuration-error`として画面に返したいので、取得はtryの中に置く
    const auth = getFirebaseAuth();

    await applyActionCode(auth, oobCode);
    return { ok: true };
  } catch (error) {
    const reason = toActionCodeFailureReason(error);
    if (reason === "unknown") {
      console.error("メールアドレスの確認を適用できませんでした", error);
    }
    return { ok: false, reason };
  }
};
