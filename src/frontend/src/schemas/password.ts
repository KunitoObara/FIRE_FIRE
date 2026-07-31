import { z } from "zod";

import { PASSWORD_RULES } from "@/constants/password";

/**
 * 新しいパスワードを設定する画面(A1サインアップ・A7パスワード再設定)で共通に使う入力値スキーマ。
 *
 * 同じポリシーを画面ごとに書くと、片方だけ条件が古くなっても気づけない。
 * 実際の強制はIdentity Platform側(サーバーサイド)で行われるため、ここでの検証は
 * 送信前に同じ理由で弾かれることを避けるための写しである(`src/constants/password.ts`)。
 */
export const newPasswordSchema = z
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
  });

/** 確認用パスワードの入力値スキーマ。一致の検証はオブジェクト側の`refine`で行う */
export const passwordConfirmationSchema = z
  .string()
  .min(1, { message: "確認用パスワードを入力してください" });

/**
 * 新パスワードと確認用が一致しているか。
 * 確認用が未入力のときは「入力してください」だけを見せ、不一致エラーを重ねて表示しない。
 */
export const matchesPasswordConfirmation = (values: {
  password: string;
  passwordConfirmation: string;
}): boolean =>
  values.passwordConfirmation.length === 0 || values.password === values.passwordConfirmation;

/** `matchesPasswordConfirmation`が偽のときに、確認用の入力欄へ出すエラー */
export const PASSWORD_CONFIRMATION_MISMATCH_ISSUE = {
  message: "パスワードが一致しません",
  path: ["passwordConfirmation"],
};
