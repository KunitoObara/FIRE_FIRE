import { z } from "zod";

/**
 * B10の本人確認で再入力するパスワードのスキーマ
 * (docs/screen-requirements-account.md B10)。
 *
 * A4と同じく、ここでは未入力だけを落とす。正しいかどうかはIdentity Platform側の照合で決まり、
 * パスワードポリシー変更前に作られたパスワードを画面側で弾いてしまうと本人確認が通らなくなる。
 *
 * 入力値の型は`src/types/account.d.ts`の`PasswordConfirmFormValues`がこのスキーマから導出する。
 */
export const passwordConfirmSchema = z.object({
  password: z.string().min(1, { message: "パスワードを入力してください" }),
});
