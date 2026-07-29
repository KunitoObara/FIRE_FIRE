/** 認証系画面(A1〜A7)で使う定数 */

import {
  DASHBOARD_PATH,
  MFA_SETUP_PATH,
  MFA_VERIFY_PATH,
  SIGNUP_PATH,
  VERIFY_EMAIL_PATH,
} from "@/constants/routes";

/**
 * A1の確認モーダルに表示するパスワードのマスク。
 * 実際の文字数を伏せるため、入力値の長さに依らない固定長にする。
 */
export const PASSWORD_MASK = "********";

/**
 * Firebaseの設定値が不足しているときに画面へ出すメッセージ。
 * 開発者本人が使う単一ユーザーアプリのため、対処法をそのまま画面に出す。
 */
export const FIREBASE_CONFIGURATION_MESSAGE =
  "Firebaseの設定が完了していません。.env.example をコピーして .env.local を作成し、設定値を記入してください。";

/**
 * 認証リクエストがFirebaseに届かなかったときに画面へ出すメッセージ。
 *
 * `.env.local` は既定でAuthエミュレータ(127.0.0.1:9099)を向くため、ローカル開発では
 * 「エミュレータを起動していない」が最も多い原因になる。単なる通信エラーとして扱うと
 * 原因に辿り着けないので、確認先を具体的に示す(README「開発サーバーを起動する」参照)。
 */
export const FIREBASE_NETWORK_ERROR_MESSAGE =
  "Firebaseに接続できませんでした。ローカル開発ではリポジトリルートで `firebase emulators:start` を実行しているか、ネットワーク接続を確認してください。";

/** サインアップ失敗のうち、特定の入力項目に紐づかずフォーム全体に出すメッセージ */
export const SIGN_UP_FORM_LEVEL_MESSAGES: Record<SignUpFormLevelFailureReason, string> = {
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "アカウントを作成できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A4ログイン失敗時のメッセージ。すべてフォーム全体のエラーとして表示する。
 *
 * 資格情報の誤りをメールアドレス欄/パスワード欄に出し分けないのは、
 * 未登録のメールアドレスかどうかを外部から判定できてしまうため。
 */
export const SIGN_IN_MESSAGES: Record<SignInFailureReason, string> = {
  "invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
  "user-disabled": "このアカウントは利用できません。",
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "ログインできませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A4で一次認証を通過したあとの遷移先。
 *
 * 2FAは全ユーザー必須(docs/auth-login-requirements.md 3.3)のため通常はA5へ進む。
 * 残り2つはサインアップを途中で離脱したアカウントの復帰経路で、未完了の手順まで戻す。
 */
export const SIGN_IN_NEXT_PATHS: Record<SignInNextStep, string> = {
  "mfa-verify": MFA_VERIFY_PATH,
  "email-unverified": VERIFY_EMAIL_PATH,
  "mfa-setup": MFA_SETUP_PATH,
};

/**
 * A2で確認メールの再送に失敗したときのメッセージ。
 * `no-session` は再送前にサインアップ画面へ戻す扱いのため、ここには含めない。
 */
export const RESEND_VERIFICATION_EMAIL_MESSAGES: Record<
  ResendVerificationEmailFailureReason,
  string
> = {
  "too-many-requests":
    "再送の回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "確認メールを再送できませんでした。しばらく待ってから再度お試しください。",
};

/** A2でメールアドレスの確認状況を取得できなかったときのメッセージ */
export const EMAIL_VERIFICATION_ERROR_MESSAGES: Record<EmailVerificationErrorStatus, string> = {
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  "unknown-error": "確認状況を取得できませんでした。しばらく待ってから再度お試しください。",
};

/** A2で確認メールの再送に成功したときのメッセージ */
export const RESEND_VERIFICATION_EMAIL_SUCCESS_MESSAGE = "確認メールを再送しました。";

/**
 * A2で「確認メールを再送する」を押してから、次に押せるようになるまでの秒数。
 * Firebase側のレート制限(auth/too-many-requests)に当たる前に、
 * 残り秒数として画面で分かる形で連打を止めるために置く。
 */
export const RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS = 60;

/** A2の再送クールダウンの残り秒数を1秒ずつ減らす間隔(ミリ秒) */
export const RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS = 1_000;

/**
 * A2でメールアドレスの確認完了を確認しにいく間隔(ミリ秒)。
 *
 * 確認リンクは別タブ・別デバイスで開かれるためA2のタブへ通知が来ない。
 * このポーリングとタブ復帰時の再確認で、ユーザー操作なしにA3へ進める。
 */
export const EMAIL_VERIFICATION_POLL_INTERVAL_MS = 5_000;

/**
 * プロジェクト側でTOTP多要素認証が有効になっていないときに画面へ出すメッセージ。
 *
 * TOTP型2FAはIdentity Platformへのアップグレードと多要素認証の有効化が前提
 * (docs/auth-login-requirements.md 3.3)。Authエミュレータでも再現されないため、
 * ローカルで登録を試すとここに来る。開発者本人が使うアプリなので対処法をそのまま出す。
 */
export const TOTP_NOT_ENABLED_MESSAGE =
  "2段階認証(TOTP)がプロジェクトで有効になっていません。FirebaseプロジェクトをIdentity Platformへアップグレードし、多要素認証のTOTPを有効化してください(ローカルのAuthエミュレータでは登録できません)。";

/** A3で再認証が必要なほどセッションが古いときに画面へ出すメッセージ */
export const REQUIRES_RECENT_LOGIN_MESSAGE =
  "セキュリティのため、ログインし直してから2段階認証を設定してください。";

/**
 * A3でQRコードを生成できなかったときのメッセージ。
 * `signed-out`・`email-unverified`・`already-enrolled` は他画面へ移す扱いのため、ここには含めない。
 */
export const TOTP_ENROLLMENT_START_MESSAGES: Record<
  TotpEnrollmentStartDisplayFailureReason,
  string
> = {
  "requires-recent-login": REQUIRES_RECENT_LOGIN_MESSAGE,
  "totp-not-enabled": TOTP_NOT_ENABLED_MESSAGE,
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "QRコードを生成できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A3で確認コードの検証に失敗したときのメッセージ。
 * `signed-out`・`already-enrolled` は他画面へ移す扱いのため、ここには含めない。
 */
export const TOTP_ENROLLMENT_MESSAGES: Record<TotpEnrollmentDisplayFailureReason, string> = {
  "invalid-verification-code":
    "確認コードが正しくありません。認証アプリに表示されている最新のコードを入力してください。",
  "requires-recent-login": REQUIRES_RECENT_LOGIN_MESSAGE,
  "totp-not-enabled": TOTP_NOT_ENABLED_MESSAGE,
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown:
    "2段階認証を設定できませんでした。QRコードを表示してから時間が経っている場合は設定の有効期限が切れている可能性があるため、QRコードを再取得してやり直してください。",
};

/**
 * A3で登録を開始できなかったとき、A3では解決できないため移す先の画面。
 * メール未確認はA2で確認を待ち、登録済みならA3に留まる意味がないためB1へ進める。
 */
export const TOTP_START_FAILURE_REDIRECTS: Record<
  TotpEnrollmentStartRedirectFailureReason,
  string
> = {
  "signed-out": SIGNUP_PATH,
  "email-unverified": VERIFY_EMAIL_PATH,
  "already-enrolled": DASHBOARD_PATH,
};

/** 上記の遷移が反映されるまでの間、A3に出しておく案内 */
export const TOTP_START_FAILURE_REDIRECT_NOTICES: Record<
  TotpEnrollmentStartRedirectFailureReason,
  string
> = {
  "signed-out": "セッションが切れました。サインアップ画面に戻ります...",
  "email-unverified": "メールアドレスの確認が必要です。確認画面に戻ります...",
  "already-enrolled": "2段階認証は設定済みです。ダッシュボードに移動します...",
};

/** A3の確認コードの桁数。認証アプリが表示するTOTPの既定値に合わせる */
export const TOTP_CODE_LENGTH = 6;

/** 確認コードの入力枠を桁数ぶん並べるための添字 */
export const TOTP_CODE_SLOT_INDEXES = Array.from({ length: TOTP_CODE_LENGTH }, (_, index) => index);

/**
 * A3で手動入力用シークレットキーを区切る文字数。
 * 連続した文字列は書き写す際に読み違えやすいため、4文字ごとに空白を入れて表示する。
 */
export const TOTP_SECRET_KEY_GROUP_SIZE = 4;

/**
 * 認証アプリ側に表示される発行者名。
 * 複数のアカウントを登録しているユーザーが、どのアプリのコードか判別できるようにする。
 */
export const TOTP_ISSUER = "FIRE-FIRE";

/** 登録した2要素目に付ける表示名。Firebase側に保存され、A5やB10で識別に使う */
export const TOTP_FACTOR_DISPLAY_NAME = "認証アプリ";
