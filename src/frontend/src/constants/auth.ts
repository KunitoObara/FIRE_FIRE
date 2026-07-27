/** 認証系画面(A1〜A7)で使う定数 */

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

/** サインアップ失敗のうち、特定の入力項目に紐づかずフォーム全体に出すメッセージ */
export const SIGN_UP_FORM_LEVEL_MESSAGES: Record<SignUpFormLevelFailureReason, string> = {
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unknown: "アカウントを作成できませんでした。しばらく待ってから再度お試しください。",
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
  unknown: "確認メールを再送できませんでした。しばらく待ってから再度お試しください。",
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
