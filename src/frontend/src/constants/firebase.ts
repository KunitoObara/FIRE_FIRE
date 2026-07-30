/** Firebaseの呼び出し先に関する定数 */

/**
 * Cloud Functionsのリージョン。
 * バックエンドの`setGlobalOptions`(src/backend/src/index.ts)と必ず揃える。
 */
export const FIREBASE_FUNCTIONS_REGION = "asia-northeast1";

/**
 * 2FAリカバリーコードを発行するcallable関数の名前(A3の登録完了時・B10の再発行)。
 * バックエンドのexport名(src/backend/src/mfa-recovery/functions.ts)と一致させる。
 */
export const GENERATE_MFA_RECOVERY_CODES_FUNCTION = "generateMfaRecoveryCodes";

/** リカバリーコードで2FA(TOTP)の登録を解除するcallable関数の名前(A5) */
export const USE_MFA_RECOVERY_CODE_FUNCTION = "useMfaRecoveryCode";
