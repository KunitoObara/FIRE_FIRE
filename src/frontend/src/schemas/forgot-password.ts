import { z } from "zod";

/**
 * A6パスワードをお忘れの方画面の入力値スキーマ(docs/screen-requirements-auth.md A6)。
 *
 * 検証するのは形式だけで、そのアドレスが登録済みかどうかは画面側で一切判定しない
 * (アカウントの存在有無を推測されないようにするため)。
 *
 * 入力値の型は`src/types/auth.d.ts`の`ForgotPasswordFormValues`がこのスキーマから導出する。
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    // A1・A4と同じく、コピー&ペーストで前後に空白が混ざったときに
    // 見た目上は正しいのに形式エラーになるのを防ぐ
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .pipe(z.email({ message: "メールアドレスの形式が正しくありません" })),
});
