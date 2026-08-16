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

/**
 * B10のアカウント削除で入力させる値(docs/auth-login-requirements.md 3.11)。
 *
 * パスワードに加えて登録メールアドレスの入力を求める。他の後戻りできない操作と違い、
 * 削除は復旧できないため確認の強度を1段上げている(PO判断)。
 *
 * **一致するかどうかはここでは見ない。** 画面は登録メールアドレスを持っているが、
 * 照合はサーバー側(`deleteAccount`)が行う。画面側だけで判定すると、UIを通さない呼び出しが
 * 確認を素通りできてしまう。ここで落とすのは未入力だけにする。
 */
export const accountDeletionSchema = z.object({
  password: z.string().min(1, { message: "パスワードを入力してください" }),
  confirmEmail: z.string().min(1, { message: "登録メールアドレスを入力してください" }),
});
