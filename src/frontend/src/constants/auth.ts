/** 認証系画面(A1〜A7)で使う定数 */

/**
 * A1の確認モーダルに表示するパスワードのマスク。
 * 実際の文字数を伏せるため、入力値の長さに依らない固定長にする。
 */
export const PASSWORD_MASK = "********";

/** サインアップ失敗のうち、特定の入力項目に紐づかずフォーム全体に出すメッセージ */
export const SIGN_UP_FORM_LEVEL_MESSAGES: Record<SignUpFormLevelFailureReason, string> = {
  "too-many-requests":
    "試行回数が多いため、一時的に制限されています。しばらく待ってから再度お試しください。",
  // 開発者本人が使う単一ユーザーアプリのため、対処法をそのまま画面に出す
  "configuration-error":
    "Firebaseの設定が完了していません。.env.example をコピーして .env.local を作成し、設定値を記入してください。",
  unknown: "アカウントを作成できませんでした。しばらく待ってから再度お試しください。",
};
