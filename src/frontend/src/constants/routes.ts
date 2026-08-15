/**
 * 画面のパス(docs/screen-list-and-transitions.md の画面ID対応)。
 * 遷移先をコンポーネント内に直接書かず、ここに集約する。
 */

/**
 * A0 サービストップページ。
 *
 * 公開画面(A0・A9・A10)は認証フローに属さず、ログイン中に開いてもB1へリダイレクトしない
 * (docs/screen-requirements-public.md 2章)。A9・A10のヘッダーのロゴから戻る先でもある。
 */
export const TOP_PATH = "/";
/** A9 利用規約画面。A0のフッターとA1の同意チェックからリンクする */
export const TERMS_PATH = "/terms";
/** A10 プライバシーポリシー画面。リンク元はA9と同じ */
export const PRIVACY_PATH = "/privacy";
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
/**
 * A8 アカウント連携画面。
 *
 * A1・A4の「Googleで続ける」で、同一メールアドレスのパスワードアカウントが既にある場合
 * (`auth/account-exists-with-different-credential`)にのみ到達する。
 */
export const LINK_ACCOUNT_PATH = "/link-account";
/** B1 ダッシュボード画面。ログイン後のトップ画面 */
export const DASHBOARD_PATH = "/dashboard";
/** B2 CSV取込画面 */
export const CSV_IMPORT_PATH = "/csv-import";
/** B3 収支明細一覧画面 */
export const TRANSACTIONS_PATH = "/transactions";
/** B4 資産分類マスタ設定画面 */
export const ASSET_CATEGORIES_PATH = "/asset-categories";
/** B5 不動産一覧画面 */
export const REAL_ESTATE_PATH = "/real-estate";
/** B7 不動産登録・編集画面(新規登録モード)。B5の「新規登録」ボタンから遷移する */
export const REAL_ESTATE_NEW_PATH = `${REAL_ESTATE_PATH}/new`;
/**
 * B6 不動産詳細画面のパス。B5の物件行から物件IDを指定して遷移する。
 *
 * サイドバーに出さない画面はパスに物件IDが入るため、文字列の組み立てもここに置く
 * (遷移先の形をコンポーネント側に散らさないため)。
 */
export const buildRealEstateDetailPath = (id: string): string =>
  `${REAL_ESTATE_PATH}/${encodeURIComponent(id)}`;
/**
 * B7 不動産登録・編集画面(編集モード)のパス。B6の「編集」ボタンから遷移する。
 *
 * 新規登録モード(`REAL_ESTATE_NEW_PATH`)と別パスにしているのは、編集対象の物件IDが
 * URLに必要なため。保存後の戻り先(B6)も同じIDで組み立てられる。
 */
export const buildRealEstateEditPath = (id: string): string =>
  `${buildRealEstateDetailPath(id)}/edit`;
/**
 * B11 負債入力画面。
 *
 * 画面IDはB10の次に採番されたが、位置付けはB2〜B4と同じ「ダッシュボードに供給するデータを
 * 管理する画面」で、サイドバーではB5の次に並べる(docs/screen-list-and-transitions.md 2.2)。
 */
export const DEBTS_PATH = "/debts";
/** B8 FIRE目標設定画面 */
export const FIRE_GOAL_PATH = "/fire-goal";
/** B9 想定利回り・リスク設定画面 */
export const ASSUMPTION_SETTINGS_PATH = "/assumptions";
/** B10 アカウント設定画面 */
export const ACCOUNT_SETTINGS_PATH = "/account";
