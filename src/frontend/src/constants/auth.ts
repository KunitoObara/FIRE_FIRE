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

/**
 * Firebase側のレート制限(`auth/too-many-requests`)に当たったときのメッセージ。
 *
 * A4のログイン失敗では、資格情報の誤りとは別の文言のままにしている。制限を招いたのは
 * 要求した本人の試行回数であり、待てば解消することを伝えないと、正しい資格情報を持つ人が
 * 誤りだと思って試行を重ね、制限をさらに延ばしてしまうため。
 * (制限がアカウント単位かIP単位かは公開ドキュメントで確認できていない。アカウント単位なら
 * 存在判定の手掛かりになり得るが、その時点で既に制限がかかっており試行を続けられない)
 */
export const TOO_MANY_REQUESTS_MESSAGE =
  "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。";

/** サインアップ失敗のうち、特定の入力項目に紐づかずフォーム全体に出すメッセージ */
export const SIGN_UP_FORM_LEVEL_MESSAGES: Record<SignUpFormLevelFailureReason, string> = {
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "アカウントを作成できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * ログインを許可しなかったことだけを伝えるメッセージ。
 *
 * メールアドレス欄/パスワード欄に出し分けず、理由も明かさない。
 * 「未登録」「無効化済み」のように状態を伝えると、そのメールアドレスが
 * 登録されているかどうかを外部から判定できてしまうため。
 *
 * ただしFirebaseからの応答自体はブラウザの開発者ツールで見えるので、これは
 * 画面表示を一貫させるための措置であり、完全な秘匿ではない。
 */
const SIGN_IN_REJECTED_MESSAGE = "メールアドレスまたはパスワードが正しくありません。";

/**
 * A4ログイン失敗時のメッセージ。すべてフォーム全体のエラーとして表示する。
 *
 * `user-disabled`を`invalid-credential`と同じ文言にしているのは上記の理由による。
 * 型としては区別したままにするが、コンソールにも出さない(`src/lib/auth/sign-in.ts`)。
 */
export const SIGN_IN_MESSAGES: Record<SignInFailureReason, string> = {
  "invalid-credential": SIGN_IN_REJECTED_MESSAGE,
  "user-disabled": SIGN_IN_REJECTED_MESSAGE,
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
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
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "QRコードを生成できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * 認証アプリの確認コードが誤っていたときのメッセージ(A3の登録・A5の検証で共通)。
 * コードは30秒程度で切り替わるため、書き写している間に古くなった可能性を示す。
 */
const TOTP_INVALID_CODE_MESSAGE =
  "確認コードが正しくありません。認証アプリに表示されている最新のコードを入力してください。";

/**
 * A3で確認コードの検証に失敗したときのメッセージ。
 * `signed-out`・`already-enrolled` は他画面へ移す扱いのため、ここには含めない。
 */
export const TOTP_ENROLLMENT_MESSAGES: Record<TotpEnrollmentDisplayFailureReason, string> = {
  "invalid-verification-code": TOTP_INVALID_CODE_MESSAGE,
  "requires-recent-login": REQUIRES_RECENT_LOGIN_MESSAGE,
  "totp-not-enabled": TOTP_NOT_ENABLED_MESSAGE,
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
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

/** A5で確認コードの検証に失敗したときのメッセージ(リカバリーコードでの失敗は後述の別表) */
export const MFA_VERIFICATION_MESSAGES: Record<MfaVerificationFailureReason, string> = {
  "invalid-verification-code": TOTP_INVALID_CODE_MESSAGE,
  "session-expired": "検証の有効期限が切れました。ログインからやり直してください。",
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  unknown: "確認コードを検証できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A5に検証待ちのログインが無いとき(直接アクセス・リロード)に出す案内。
 *
 * 検証セッションはメモリ上でしか受け渡さないため、この状態は一次認証からやり直すほかない
 * (`src/lib/auth/pending-login.ts`)。A4へ遷移するまでの間だけ表示される。
 *
 * 何かに失敗したわけではなく検証セッションが無いだけなので、
 * 「〜できませんでした」とは書かず、やり直しの手順だけを伝える。
 */
export const MFA_VERIFY_NO_SESSION_NOTICE =
  "ログインからやり直してください。ログイン画面に戻ります...";

/** A3・A5の確認コードの桁数。認証アプリが表示するTOTPの既定値に合わせる */
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

/**
 * Cloud Functions(callable)に到達できなかった・サーバー側で処理しきれなかったときのメッセージ。
 *
 * 通信不能とサーバー側の想定外エラーはSDK上どちらも`functions/internal`になり区別できない
 * (`src/lib/auth/mfa-recovery.ts`)。ローカル開発ではfunctionsエミュレータの未起動が
 * 最も多い原因になるため、確認先を具体的に示す。
 */
export const FUNCTIONS_UNAVAILABLE_MESSAGE =
  "サーバー側の処理に接続できませんでした。ローカル開発ではリポジトリルートで `firebase emulators:start` を実行しているか、ネットワーク接続を確認してください。";

/**
 * A3の2FA登録完了後・B10の再発行でリカバリーコードを発行できなかったときのメッセージ。
 *
 * `signed-out`は他画面へ移す扱いのため、ここには含めない。
 */
export const MFA_RECOVERY_ISSUE_MESSAGES: Record<
  Exclude<MfaRecoveryIssueFailureReason, "signed-out">,
  string
> = {
  "email-unverified":
    "メールアドレスの確認が完了していないため、リカバリーコードを発行できません。",
  "mfa-not-enrolled":
    "2段階認証の登録が完了していないため、リカバリーコードを発行できません。設定をやり直してください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: FUNCTIONS_UNAVAILABLE_MESSAGE,
  unknown: "リカバリーコードを発行できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A3でリカバリーコードを発行できなかったときの補足。
 *
 * 2FAの登録自体は完了しているため、コードが無いままでもログインはできる。
 * B10で再発行できることを伝えて、この画面で行き止まりにしない。
 */
export const MFA_RECOVERY_ISSUE_FAILURE_NOTICE =
  "2段階認証の設定自体は完了しています。リカバリーコードはアカウント設定画面からあとで発行できます。";

/** A5でリカバリーコードによる2FA解除に失敗したときのメッセージ */
export const MFA_RECOVERY_USE_MESSAGES: Record<MfaRecoveryUseFailureReason, string> = {
  "invalid-recovery-code":
    "リカバリーコードが正しくありません。使用済みのコードは再度使えないため、別のコードを入力してください。",
  // A5に来ている時点で一次認証は通っているため、通常は起きない
  // (パスワード変更直後にA5へ戻った場合など、A4からやり直してもらうほかない)
  "invalid-credential": "ログイン情報を確認できませんでした。ログイン画面からやり直してください。",
  "no-recovery-codes": "利用できるリカバリーコードがありません。すべて使用済みの可能性があります。",
  "mfa-not-enrolled": "2段階認証が登録されていません。ログイン画面からやり直してください。",
  // 入力したコードは消費済みで元に戻らないため、同じコードでの再試行を促さない
  "unenroll-failed":
    "入力したリカバリーコードは使用済みになりましたが、2段階認証を解除できませんでした。しばらく待ってから、別のリカバリーコードで再度お試しください。",
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: FUNCTIONS_UNAVAILABLE_MESSAGE,
  unknown: "リカバリーコードを検証できませんでした。しばらく待ってから再度お試しください。",
};

/**
 * A5でリカバリーコードによる解除に成功したが、その後のログインをやり直せなかったときのメッセージ。
 *
 * 2FAの解除自体は済んでいるので、ログイン画面からやり直せば2FAの再登録(A3)へ進める。
 */
export const MFA_RECOVERY_RESIGN_IN_FAILURE_MESSAGE =
  "2段階認証を解除しました。ログイン画面からログインし直して、認証アプリを登録してください。";

/**
 * ダウンロード用に作ったBlobのURLを解放するまでの待ち時間(ミリ秒)。
 *
 * クリックの直後に解放すると、ブラウザがダウンロードを始める前に無効化してしまい
 * 保存に失敗することがある。平文のコードはA3の表示でしか手に入らないため、
 * 解放を遅らせて取りこぼしを避ける(`src/lib/auth/recovery-code-file.ts`)。
 */
export const RECOVERY_CODE_URL_REVOKE_DELAY_MS = 1_000;

/** ダウンロードするリカバリーコードのファイル名の接頭辞(`fire-fire-recovery-codes-20260730.txt`) */
export const RECOVERY_CODE_FILE_NAME_PREFIX = "fire-fire-recovery-codes";

/** ダウンロードするファイルの見出し */
export const RECOVERY_CODE_FILE_TITLE = "FIRE-FIRE 2段階認証 リカバリーコード";

/**
 * ダウンロードするファイルに残す注意事項。
 * ファイルは発行から時間が経ってから開かれるため、画面の説明に頼らず前提を持たせる。
 */
export const RECOVERY_CODE_FILE_NOTES = [
  "各コードは一度だけ使用できます。",
  "認証アプリを紛失したときに、ログイン画面の2段階認証で「リカバリーコードを使う」から入力します。",
  "リカバリーコードを使うと2段階認証の登録が解除されるため、ログイン後に認証アプリを登録し直してください(リカバリーコードも新しく発行されます)。",
  "他人に渡さず、安全な場所に保管してください。",
];
