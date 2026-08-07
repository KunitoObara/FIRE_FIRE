import { httpsCallable } from "firebase/functions";
import { z } from "zod";

import {
  GENERATE_MFA_RECOVERY_CODES_FUNCTION,
  GET_MFA_RECOVERY_CODE_STATUS_FUNCTION,
  USE_MFA_RECOVERY_CODE_FUNCTION,
} from "@/constants/firebase";
import { toCallableFailureReason } from "@/lib/auth/callable-error";
import { getFirebaseFunctions } from "@/lib/firebase/client";

/**
 * 2FAリカバリーコードの発行・使用・発行状況の取得(docs/auth-login-requirements.md 3.3)。
 *
 * Identity Platformにバックアップコードの機能が無いため、発行も検証もCloud Functionsで行う
 * (src/backend/src/mfa-recovery/functions.ts)。この画面側モジュールはcallableの呼び出しと、
 * 失敗理由・応答の境界づけだけを担う。
 */

/** callableの応答は外部入力として扱い、形を確定させてから画面に渡す */
const issueResponseSchema = z.object({
  codes: z.array(z.string().min(1)).min(1),
});

const useResponseSchema = z.object({
  remainingCodes: z.number().int().nonnegative(),
});

const statusResponseSchema = z.object({
  generatedAt: z.number().nullable(),
  remainingCodes: z.number().int().nonnegative(),
  totalCodes: z.number().int().nonnegative(),
});

/** バックエンドの`details.reason`として受け付ける値(発行) */
const ISSUE_FAILURE_REASONS: readonly MfaRecoveryIssueFailureReason[] = [
  "signed-out",
  "email-unverified",
  "mfa-not-enrolled",
  "password-required",
  "invalid-credential",
  "too-many-requests",
];

/** バックエンドの`details.reason`として受け付ける値(発行状況の取得) */
const STATUS_FAILURE_REASONS: readonly MfaRecoveryStatusFailureReason[] = ["signed-out"];

/** バックエンドの`details.reason`として受け付ける値(2FA解除) */
const USE_FAILURE_REASONS: readonly MfaRecoveryUseFailureReason[] = [
  "invalid-recovery-code",
  "invalid-credential",
  "no-recovery-codes",
  "mfa-not-enrolled",
  "unenroll-failed",
  "too-many-requests",
  "unavailable",
];

/**
 * リカバリーコードを発行して平文を受け取る(A3の2FA登録完了時・B10の再発行)。
 *
 * 既に発行済みのコードは無効になる。平文が手に入るのはこの戻り値だけで、
 * 画面を離れると再取得できない(ユーザーには保存を促す)。
 *
 * 有効なコードが残っている状態での発行(=B10の再発行)はサーバー側が本人確認を求めるため、
 * `password`を渡す。A3の初回発行では不要なので省略する。
 */
export const issueRecoveryCodes = async (password?: string): Promise<MfaRecoveryIssueResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), GENERATE_MFA_RECOVERY_CODES_FUNCTION);
    const response = await callable(password === undefined ? {} : { password });
    const parsed = issueResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error("リカバリーコードの応答を解釈できませんでした", parsed.error.issues);
      return { ok: false, reason: "unknown" };
    }

    return { ok: true, codes: parsed.data.codes };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        ISSUE_FAILURE_REASONS,
        "リカバリーコードを発行できませんでした",
      ),
    };
  }
};

/**
 * リカバリーコードの発行状況(残り本数)を取得する(B10の表示)。
 *
 * Firestoreの`mfaRecoveryCodes`はセキュリティルールでクライアントからの参照を
 * 全面的に拒否しているため、直接読まずcallableを通す。平文もハッシュも返らない。
 */
export const fetchRecoveryCodeStatus = async (): Promise<MfaRecoveryStatusResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), GET_MFA_RECOVERY_CODE_STATUS_FUNCTION);
    const response = await callable();
    const parsed = statusResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error("リカバリーコードの発行状況を解釈できませんでした", parsed.error.issues);
      return { ok: false, reason: "unknown" };
    }

    return { ok: true, status: parsed.data };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        STATUS_FAILURE_REASONS,
        "リカバリーコードの発行状況を取得できませんでした",
      ),
    };
  }
};

/**
 * リカバリーコードで2FA(TOTP)の登録を解除する(A5「リカバリーコードを使う」)。
 *
 * これで解除されるのは2要素目の登録だけで、サインインは成立しない。呼び出し側は解除後に
 * 通常のログインをやり直し、2FA未登録として扱われるA3の再登録へ進む
 * (docs/screen-requirements-auth.md A5)。
 *
 * パスワードは一次認証の通過をサーバー側で確かめるために渡す(A4からメモリで引き継いだ値)。
 */
export const redeemRecoveryCode = async (
  email: string,
  password: string,
  recoveryCode: string,
): Promise<MfaRecoveryUseResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), USE_MFA_RECOVERY_CODE_FUNCTION);
    const response = await callable({ email, password, recoveryCode });
    const parsed = useResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      // 解除自体は成功している可能性があるが、画面としては続けようがないため失敗として扱う
      console.error("2段階認証の解除の応答を解釈できませんでした", parsed.error.issues);
      return { ok: false, reason: "unknown" };
    }

    return { ok: true, remainingCodes: parsed.data.remainingCodes };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        USE_FAILURE_REASONS,
        "リカバリーコードを検証できませんでした",
      ),
    };
  }
};
