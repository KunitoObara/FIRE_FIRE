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
 * Firestoreのクエリが受け付ける`limit()`の最大値。
 *
 * これを超える値を指定すると、クエリはドキュメントを1件も返さず`invalid-argument`で
 * 拒否される(`Limit value in the structured query is over the maximum value of 10000`)。
 * 件数の上限は「読みすぎないための歯止め」として自由に決められる値に見えるが、
 * 実際にはFirestore側の制約が天井になる。
 *
 * クエリを組み立てる側が直接この値を使うことは想定していない。走査件数の上限は用途ごとに
 * 別々の定数として持ち(`ASSET_SNAPSHOT_SCAN_LIMIT`・`ASSET_TYPE_SCAN_LIMIT`)、
 * それらがこの天井を超えていないことをテストで固定するために置いている。
 * Firestoreをモックしたテストではサーバー側の制約を踏めないため、静的に縛る必要がある。
 */
export const FIRESTORE_QUERY_LIMIT_MAX = 10_000;

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

/**
 * 本人確認のうえアカウントと利用者のデータをすべて削除するcallable関数の名前(B10)。
 * バックエンドのexport名(src/backend/src/account-deletion/functions.ts)と一致させる。
 */
export const DELETE_ACCOUNT_FUNCTION = "deleteAccount";

/**
 * アカウント削除の呼び出しを待つ時間(ミリ秒)。
 *
 * **バックエンドの`timeoutSeconds`(300秒)と必ず揃える**
 * (src/backend/src/account-deletion/functions.ts)。SDKの既定は70秒で、指定しないと
 * **サーバー側を延ばした意味が消える** — 取引が積み上がったアカウントで再帰削除が
 * 70秒を超えると、削除は進んでいるのにクライアントだけ先に諦めてエラーを見せることになる。
 * リポジトリが別で値そのものは共有できないため、両側にこの注記を置いて片方だけ変わるのを防ぐ。
 */
export const DELETE_ACCOUNT_TIMEOUT_MS = 300_000;

/**
 * お問い合わせを送信するcallable関数の名前(A11)。
 * バックエンドのexport名(src/backend/src/contact/functions.ts)と一致させる。
 */
export const SEND_CONTACT_MESSAGE_FUNCTION = "sendContactMessage";
