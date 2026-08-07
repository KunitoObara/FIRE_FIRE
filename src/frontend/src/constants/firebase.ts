/** Firebaseの呼び出し先に関する定数 */

/**
 * Cloud Functionsのリージョン。
 * バックエンドの`setGlobalOptions`(src/backend/src/index.ts)と必ず揃える。
 */
export const FIREBASE_FUNCTIONS_REGION = "asia-northeast1";

/**
 * 本番のFirebaseプロジェクトID。
 *
 * ローカル開発の接続先が誤って本番になっていないかの判定にだけ使う
 * (`src/lib/firebase/client.ts`)。B0-1でエミュレータを廃止し、接続先が`.env.local`の値だけで
 * 決まるようになったため、この照合が本番への誤接続を止める唯一の砦になっている。
 */
export const PRODUCTION_FIREBASE_PROJECT_ID = "fire-fire-prod";

/**
 * 2FAリカバリーコードを発行するcallable関数の名前(A3の登録完了時・B10の再発行)。
 * バックエンドのexport名(src/backend/src/mfa-recovery/functions.ts)と一致させる。
 */
export const GENERATE_MFA_RECOVERY_CODES_FUNCTION = "generateMfaRecoveryCodes";

/** リカバリーコードの発行状況(残り本数・発行日時)を取得するcallable関数の名前(B10) */
export const GET_MFA_RECOVERY_CODE_STATUS_FUNCTION = "getMfaRecoveryCodeStatus";

/** リカバリーコードで2FA(TOTP)の登録を解除するcallable関数の名前(A5) */
export const USE_MFA_RECOVERY_CODE_FUNCTION = "useMfaRecoveryCode";

/** 本人確認のうえ2FA(TOTP)の登録を解除するcallable関数の名前(B10の「2FAを再設定する」) */
export const RESET_MFA_ENROLLMENT_FUNCTION = "resetMfaEnrollment";

/**
 * 本人確認のうえメールアドレス / パスワードでのログインを解除するcallable関数の名前(B10)。
 * バックエンドのexport名(src/backend/src/linked-providers/functions.ts)と一致させる。
 */
export const UNLINK_PASSWORD_PROVIDER_FUNCTION = "unlinkPasswordProvider";
