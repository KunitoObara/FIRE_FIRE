import { z } from "zod";

import {
  matchesPasswordConfirmation,
  newPasswordSchema,
  PASSWORD_CONFIRMATION_MISMATCH_ISSUE,
  passwordConfirmationSchema,
} from "@/schemas/password";

/**
 * A7パスワード再設定画面の入力値スキーマ(docs/screen-requirements-auth.md A7)。
 *
 * 適用するパスワードポリシーはA1サインアップと同じ(docs/auth-login-requirements.md 3.5)。
 * 入力値の型は`src/types/auth.d.ts`の`ResetPasswordFormValues`がこのスキーマから導出する。
 */
export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    passwordConfirmation: passwordConfirmationSchema,
  })
  .refine(matchesPasswordConfirmation, PASSWORD_CONFIRMATION_MISMATCH_ISSUE);
