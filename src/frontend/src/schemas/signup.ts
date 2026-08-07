import { z } from "zod";

import {
  matchesPasswordConfirmation,
  newPasswordSchema,
  PASSWORD_CONFIRMATION_MISMATCH_ISSUE,
  passwordConfirmationSchema,
} from "@/schemas/password";

/**
 * A1サインアップ画面の入力値スキーマ(docs/screen-requirements-auth.md A1)。
 * 「メール形式・パスワードポリシー・パスワード一致・規約同意チェック済み」の4条件を表す。
 *
 * パスワード関連の検証はA7パスワード再設定と共通のため`@/schemas/password`に置く。
 * 入力値の型は`src/types/auth.d.ts`の`SignupFormValues`がこのスキーマから導出する。
 */
export const signupSchema = z
  .object({
    email: z
      .string()
      // コピー&ペーストで前後に空白が混ざると形式エラーになり、見た目上は正しいので
      // 原因が分からない。表示上のエラーもFirebaseへ渡す値も安定させるため先に落とす
      .trim()
      .min(1, { message: "メールアドレスを入力してください" })
      .pipe(z.email({ message: "メールアドレスの形式が正しくありません" })),
    password: newPasswordSchema,
    passwordConfirmation: passwordConfirmationSchema,
    agreedToTerms: z.boolean().refine((agreed) => agreed, {
      message: "利用規約とプライバシーポリシーに同意してください",
    }),
  })
  .refine(matchesPasswordConfirmation, PASSWORD_CONFIRMATION_MISMATCH_ISSUE);
