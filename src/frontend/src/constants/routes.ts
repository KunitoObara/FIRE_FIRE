/**
 * 画面のパス(docs/screen-list-and-transitions.md の画面ID対応)。
 * 遷移先をコンポーネント内に直接書かず、ここに集約する。
 */

/** A1 サインアップ画面 */
export const SIGNUP_PATH = "/signup";
/** A2 メールアドレス確認待ち画面 */
export const VERIFY_EMAIL_PATH = "/verify-email";
/** A3 2FA登録画面 */
export const MFA_SETUP_PATH = "/mfa-setup";
/** A4 ログイン画面 */
export const LOGIN_PATH = "/login";
/** A5 2FA検証画面 */
export const MFA_VERIFY_PATH = "/mfa-verify";
/** A6 パスワードをお忘れの方画面 */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
/** A7 パスワード再設定画面。リセットメールのリンク(oobCode付き)から到達する */
export const RESET_PASSWORD_PATH = "/reset-password";
/**
 * Firebaseが送るメール内リンクの受け口。
 *
 * アクションURLはプロジェクトに1つしか設定できず、パスワード再設定・メールアドレス確認の
 * どちらのリンクもここに来るため、`mode`で振り分ける(docs/ci-cd-setup.md)。
 */
export const AUTH_ACTION_PATH = "/auth/action";
/** B1 ダッシュボード画面。別カードで実装するため、現時点では遷移先が存在しない。 */
export const DASHBOARD_PATH = "/dashboard";
