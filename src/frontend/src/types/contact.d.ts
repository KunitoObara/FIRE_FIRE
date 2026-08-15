import type { z } from "zod";

import type { contactSchema } from "@/schemas/contact";

// A11 お問い合わせ画面の型。import を持つため既にモジュールであり、
// `declare global` でグローバルへ公開する。
declare global {
  /** A11の入力値。同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する */
  type ContactFormValues = z.infer<typeof contactSchema>;

  /**
   * 問い合わせを送れなかった理由
   * (`src/lib/contact/send-contact-message.ts`、src/backend/src/contact/functions.ts)。
   */
  type ContactFailureReason =
    /** 送信の間隔が空いていない */
    | "throttled"
    /** 上流(Resend)へ送れなかった */
    | "send-failed"
    /** 宛先かAPIキーが未設定。デプロイ側の不備で、利用者にはやり直しを促すしかない */
    | "not-configured"
    /** 入力が不正。画面側で先に落とすため通常は来ない */
    | "invalid-argument"
    | CallableSharedFailureReason;

  type ContactResult = { ok: true } | { ok: false; reason: ContactFailureReason };
}
