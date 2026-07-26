import { z } from "zod";

import { PASSWORD_RULES } from "@/constants/password";

/**
 * A1サインアップ画面の入力値スキーマ(docs/screen-requirements-auth.md A1)。
 * 「メール形式・パスワードポリシー・パスワード一致・規約同意チェック済み」の4条件を表す。
 *
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
    password: z
      .string()
      .min(1, { message: "パスワードを入力してください" })
      .superRefine((password, ctx) => {
        // 未入力時は「入力してください」だけを見せ、ポリシー違反を重ねて表示しない
        if (password.length === 0) {
          return;
        }

        PASSWORD_RULES.forEach((rule) => {
          if (!rule.satisfiedBy(password)) {
            ctx.addIssue({ code: "custom", message: rule.message });
          }
        });
      }),
    passwordConfirmation: z.string().min(1, { message: "確認用パスワードを入力してください" }),
    agreedToTerms: z.boolean().refine((agreed) => agreed, {
      message: "利用規約とプライバシーポリシーに同意してください",
    }),
  })
  // 確認用が未入力のときは「入力してください」だけを見せ、不一致エラーを重ねて表示しない
  .refine(
    (values) =>
      values.passwordConfirmation.length === 0 || values.password === values.passwordConfirmation,
    {
      message: "パスワードが一致しません",
      path: ["passwordConfirmation"],
    },
  );
