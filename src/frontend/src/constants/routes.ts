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
 * どちらのリンクもここに来るため、`mode`で振り分ける(docs/ci-cd-setup.md 12章)。
 *
 * アプリ内に遷移元が無く(到達するのはメールのリンクだけ)、ルーティングもファイル配置で
 * 決まるため**コードからは参照されない**。それでもここに置くのは、Firebaseコンソールへ
 * 設定するパスの正がこの一覧にある状態を保つため。画面のパスを1か所に集める方針
 * (docs/CODING_STANDARDS.md 3章)に沿って、参照が無くても削除しない。
 */
export const AUTH_ACTION_PATH = "/auth/action";
/** B1 ダッシュボード画面。別カードで実装するため、現時点では遷移先が存在しない。 */
export const DASHBOARD_PATH = "/dashboard";
