/**
 * 問い合わせメールの件名・本文の組み立て(docs/screen-requirements-public.md A11)。
 *
 * 受け取るのは開発者本人だけなので、装飾は要らない。**送信者が書いた内容をそのまま読めること**と、
 * **どの環境から来たかが分かること**の2つだけを満たす。本文はログイン通知と同じくプレーンテキスト。
 */

/** 画面から受け取る問い合わせ1件 */
export type ContactMessageInput = {
  /** 返信先。返信できないと問い合わせを受ける意味が無いので必須にする */
  email: string;
  body: string;
};

export type ContactMail = {
  subject: string;
  text: string;
};

/** 本番のFirebaseプロジェクトID(`login-notification/message.ts`と同じ扱い) */
const PROD_PROJECT_ID = "fire-fire-prod";

/**
 * 件名。
 *
 * **本文の1行目を件名に混ぜない。** 受信箱の一覧に他人が書いた文章がそのまま並ぶことになり、
 * 長さも内容も選べない。件名は固定にして、判別に要る環境の印だけを足す。
 */
const SUBJECT = "FIRE-FIRE お問い合わせ";

/**
 * 問い合わせメールを組み立てる。
 *
 * 本番以外からの送信には件名に`[dev]`を付ける。ローカル開発もSTGのFirebaseに直結しており
 * (CLAUDE.md「B0-1」)、区別が無いと受信箱で本番の問い合わせと混ざるため
 * (ログイン通知と同じ理由・同じ印)。
 */
export const buildContactMail = (
  input: ContactMessageInput,
  projectId: string,
  receivedAt: Date,
): ContactMail => {
  const isProduction = projectId === PROD_PROJECT_ID;
  const environmentTag = isProduction ? "" : "[dev] ";

  const formattedReceivedAt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(receivedAt);

  const text = [
    "FIRE-FIRE のお問い合わせフォームから送信されました。",
    "",
    `返信先: ${input.email}`,
    `受信日時: ${formattedReceivedAt}(日本時間)`,
    `プロジェクト: ${projectId === "" ? "(不明)" : projectId}`,
    "",
    "----------------------------------------",
    input.body,
    "----------------------------------------",
  ].join("\n");

  return { subject: `${environmentTag}${SUBJECT}`, text };
};
