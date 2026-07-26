/**
 * 画面のパス(docs/screen-list-and-transitions.md の画面ID対応)。
 * 遷移先をコンポーネント内に直接書かず、ここに集約する。
 */

/** A1 サインアップ画面 */
export const SIGNUP_PATH = "/signup";
/** A2 メールアドレス確認待ち画面。別カードで実装するため、現時点では遷移先が存在しない。 */
export const VERIFY_EMAIL_PATH = "/verify-email";
/** A4 ログイン画面。別カードで実装するため、現時点では遷移先が存在しない。 */
export const LOGIN_PATH = "/login";
