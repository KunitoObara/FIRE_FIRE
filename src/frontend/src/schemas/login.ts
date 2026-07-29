import { z } from "zod";

/**
 * A4ログイン画面の入力値スキーマ(docs/screen-requirements-auth.md A4)。
 *
 * 登録時と違いパスワードポリシーは検証しない。ログインの成否はIdentity Platform側の
 * 照合結果だけで決まるため、ポリシー変更前に作られたパスワードを画面側で弾いてしまうと
 * 正しい資格情報でもログインできなくなる。ここでは未入力だけを落とす。
 *
 * 入力値の型は`src/types/auth.d.ts`の`LoginFormValues`がこのスキーマから導出する。
 */
export const loginSchema = z.object({
  email: z
    .string()
    // A1と同じく、コピー&ペーストで前後に空白が混ざったときに
    // 見た目上は正しいのに形式エラーになるのを防ぐ
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .pipe(z.email({ message: "メールアドレスの形式が正しくありません" })),
  password: z.string().min(1, { message: "パスワードを入力してください" }),
  /** 「ログイン状態を保持する」。Firebase Authのセッション永続化の選択に使う */
  rememberMe: z.boolean(),
});
