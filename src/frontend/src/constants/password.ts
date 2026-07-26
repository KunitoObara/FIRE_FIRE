/**
 * パスワードポリシー(docs/auth-login-requirements.md 3.2)。
 *
 * 正となる強制はIdentity Platformのパスワードポリシー機能(サーバーサイド)であり、
 * ここでの定義はA1サインアップ画面のリアルタイム表示と送信前バリデーションのための写しである。
 * 片方だけを変更すると挙動が食い違うため、条件を変える場合はコンソール設定と同時に更新すること。
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH}文字以上`,
    message: `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`,
    satisfiedBy: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter-case",
    label: "大文字・小文字を含む",
    message: "大文字と小文字をそれぞれ1文字以上含めてください",
    satisfiedBy: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
  {
    id: "digit",
    label: "数字を含む",
    message: "数字を1文字以上含めてください",
    satisfiedBy: (password) => /[0-9]/.test(password),
  },
  {
    id: "symbol",
    label: "記号を含む",
    // Identity Platform側の要求は「非英数字」なので、判定もその定義に合わせる
    message: "記号を1文字以上含めてください",
    satisfiedBy: (password) => /[^a-zA-Z0-9]/.test(password),
  },
];
