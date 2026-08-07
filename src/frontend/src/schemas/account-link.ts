import { z } from "zod";

/**
 * A8アカウント連携画面の入力値スキーマ(docs/screen-requirements-auth.md A8)。
 *
 * メールアドレスはGoogleから取得済みで入力欄が無いため、パスワードだけを扱う。
 * A4と同じくパスワードポリシーは検証しない(既に登録済みのパスワードを照合するだけで、
 * ポリシー変更前に作られたパスワードを画面側で弾くと連携できなくなるため)。
 *
 * 入力値の型は`src/types/auth.d.ts`の`AccountLinkFormValues`がこのスキーマから導出する。
 */
export const accountLinkSchema = z.object({
  password: z.string().min(1, { message: "パスワードを入力してください" }),
});
