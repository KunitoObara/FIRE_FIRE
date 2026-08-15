import { z } from "zod";

/**
 * A11 お問い合わせフォームの入力(docs/screen-requirements-public.md A11)。
 *
 * 上限はバックエンド(`src/backend/src/contact/functions.ts`)と揃える。画面側で先に落とすのは、
 * 送ってから断られるより早く伝わるため。**画面だけの検査で済ませない** — UIを通さない呼び出しが
 * あるので、同じ上限をサーバー側にも置いてある。
 */

/** 本文の上限。バックエンドの`MAX_BODY_LENGTH`と同じ値にする */
export const CONTACT_BODY_MAX_LENGTH = 2_000;

/** メールアドレスの上限。バックエンドの`MAX_EMAIL_LENGTH`と同じ値にする */
const CONTACT_EMAIL_MAX_LENGTH = 320;

export const contactSchema = z.object({
  email: z
    .string()
    // A1・A4・A6と同じく、コピー&ペーストで前後に空白が混ざったときに
    // 見た目上は正しいのに形式エラーになるのを防ぐ
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .max(CONTACT_EMAIL_MAX_LENGTH, { message: "メールアドレスが長すぎます" })
    .pipe(z.email({ message: "メールアドレスの形式が正しくありません" })),
  body: z
    .string()
    .trim()
    .min(1, { message: "お問い合わせ内容を入力してください" })
    .max(CONTACT_BODY_MAX_LENGTH, {
      message: `お問い合わせ内容は${CONTACT_BODY_MAX_LENGTH.toLocaleString()}文字以内で入力してください`,
    }),
  /**
   * ハニーポット。画面では隠してあり、**人が使う限り空のまま**になる。
   *
   * 検証しない(空でなくてもこのスキーマは通す)。埋まっていた場合の扱いはサーバー側が決める
   * — 画面で弾くと、弾かれたことが送信側に分かってしまう。
   */
  website: z.string(),
});
