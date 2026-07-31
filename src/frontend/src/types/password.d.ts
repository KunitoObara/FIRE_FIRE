// パスワードポリシー関連の型。
// `export {}` でモジュール扱いにしてから `declare global` でグローバルへ公開する
// (import を持たない .d.ts は既にグローバルスクリプトのため `declare global` が使えない)。
export {};

declare global {
  /** パスワードポリシーの各条件を識別するキー */
  type PasswordRuleId = "length" | "letter-case" | "digit" | "symbol";

  /**
   * パスワードポリシーの1条件。
   * 充足判定・リアルタイム表示のラベル・違反時のエラー文言を1つにまとめ、
   * バリデーションと画面表示が同じ定義を参照できるようにする。
   */
  type PasswordRule = {
    id: PasswordRuleId;
    /** 充足状況リストに表示する条件名 */
    label: string;
    /** 未充足のときにインラインエラーとして表示する文言 */
    message: string;
    satisfiedBy: (password: string) => boolean;
  };

  /** パスワードポリシーの充足状況リストのProps(A1・A7) */
  type PasswordPolicyChecklistProps = {
    /** 入力中のパスワード。1文字ごとに充足状況を評価し直す */
    password: string;
  };
}
