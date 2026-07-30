import { httpsCallable } from "firebase/functions";
import { z } from "zod";

import {
  GENERATE_MFA_RECOVERY_CODES_FUNCTION,
  USE_MFA_RECOVERY_CODE_FUNCTION,
} from "@/constants/firebase";
import { FirebaseConfigurationError, getFirebaseFunctions } from "@/lib/firebase/client";

/**
 * 2FAリカバリーコードの発行・使用(docs/auth-login-requirements.md 3.3)。
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

/**
 * callableのエラー。
 *
 * `code`はFirebaseが付ける`functions/*`のコード、`details.reason`はバックエンドが載せた
 * 機械可読な理由。`instanceof`に頼らずプロパティを検証するのは、SDKの実装(FunctionsError)に
 * 依存せずに済ませるため。
 */
const callableErrorSchema = z.object({
  code: z.string(),
  details: z.object({ reason: z.string() }).optional(),
});

/** バックエンドの`details.reason`として受け付ける値(発行) */
const ISSUE_FAILURE_REASONS: readonly MfaRecoveryIssueFailureReason[] = [
  "email-unverified",
  "mfa-not-enrolled",
];

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
 * バックエンドが返した理由を画面用の理由に読み替える。
 *
 * `unauthenticated`だけは名前が違う(画面側は他の画面と揃えて`signed-out`と呼ぶ)。
 * 未知の理由は`undefined`を返し、呼び出し側でFirebaseのエラーコードから決め直す。
 */
const toIssueFailureReason = (reason: string): MfaRecoveryIssueFailureReason | undefined =>
  reason === "unauthenticated"
    ? "signed-out"
    : ISSUE_FAILURE_REASONS.find((known) => known === reason);

const toUseFailureReason = (reason: string): MfaRecoveryUseFailureReason | undefined =>
  USE_FAILURE_REASONS.find((known) => known === reason);

/**
 * `functions/*`のエラーコードから理由を決める。
 *
 * callableに到達できなかった場合もSDKは`functions/internal`を投げるため、
 * 通信不能とサーバー側の想定外エラーは区別せず`unavailable`に寄せる
 * (どちらも画面では「時間をおいて再試行」以外にできることが無い)。
 */
const toFailureReasonFromCode = (code: string): "unavailable" | "unknown" =>
  code === "functions/internal" || code === "functions/unavailable" ? "unavailable" : "unknown";

/**
 * リカバリーコードを発行して平文を受け取る(A3の2FA登録完了時・B10の再発行)。
 *
 * 既に発行済みのコードは無効になる。平文が手に入るのはこの戻り値だけで、
 * 画面を離れると再取得できない(ユーザーには保存を促す)。
 */
export const issueRecoveryCodes = async (): Promise<MfaRecoveryIssueResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), GENERATE_MFA_RECOVERY_CODES_FUNCTION);
    const response = await callable();
    const parsed = issueResponseSchema.safeParse(response.data);

    if (!parsed.success) {
      console.error("リカバリーコードの応答を解釈できませんでした", parsed.error.issues);
      return { ok: false, reason: "unknown" };
    }

    return { ok: true, codes: parsed.data.codes };
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      return { ok: false, reason: "configuration-error" };
    }

    const parsed = callableErrorSchema.safeParse(error);
    if (!parsed.success) {
      console.error("リカバリーコードを発行できませんでした", error);
      return { ok: false, reason: "unknown" };
    }

    const reason =
      parsed.data.details === undefined
        ? undefined
        : toIssueFailureReason(parsed.data.details.reason);

    if (reason !== undefined) {
      return { ok: false, reason };
    }

    console.error("リカバリーコードを発行できませんでした", parsed.data.code);
    return { ok: false, reason: toFailureReasonFromCode(parsed.data.code) };
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
    if (error instanceof FirebaseConfigurationError) {
      return { ok: false, reason: "configuration-error" };
    }

    const parsed = callableErrorSchema.safeParse(error);
    if (!parsed.success) {
      console.error("リカバリーコードを検証できませんでした", error);
      return { ok: false, reason: "unknown" };
    }

    const reason =
      parsed.data.details === undefined
        ? undefined
        : toUseFailureReason(parsed.data.details.reason);

    if (reason !== undefined) {
      return { ok: false, reason };
    }

    console.error("リカバリーコードを検証できませんでした", parsed.data.code);
    return { ok: false, reason: toFailureReasonFromCode(parsed.data.code) };
  }
};
