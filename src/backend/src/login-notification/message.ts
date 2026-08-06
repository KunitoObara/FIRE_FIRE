/**
 * ログイン通知メールの件名・本文の組み立て(docs/auth-login-requirements.md 3.6)。
 *
 * 3.6が求めるのは「日時・利用デバイス/ブラウザ情報などログインを識別できる情報」で、
 * 3.8がこれに「利用したログイン方法(パスワード / Google)」を足す。身に覚えのない
 * ログインに気づけることが目的なので、判断材料は削らず全部載せる。
 *
 * 本文はプレーンテキストのみ。認証周りの通知でHTMLを組む理由が無く、テキストのほうが
 * 送信側の見た目の差異に左右されない。
 */

import { describeClient } from "./login-context";

/** メールに載せる1回分のログイン */
export type LoginNotificationContext = {
  /** サインインが成立した時刻 */
  signedInAt: Date;
  /** `resolveSignInMethodLabel`が返す表示用のログイン方法 */
  signInMethod: string;
  ipAddress: string;
  userAgent: string;
  /** 実行中のFirebaseプロジェクトID。開発環境からの通知を見分けるために載せる */
  projectId: string;
};

export type LoginNotificationMail = {
  subject: string;
  text: string;
};

/**
 * 本番のFirebaseプロジェクトID。
 *
 * ここに一致しないプロジェクト(`fire-fire-dev`、エミュレータ等)からの通知は、
 * 件名と本文で開発環境である旨を示す。ローカル開発もSTGのFirebaseに直結しているため
 * (CLAUDE.md「B0-1」)、区別が無いと受信箱で本番のログインと混ざる。
 */
const PROD_PROJECT_ID = "fire-fire-prod";

/**
 * 日時をJSTで表示する。
 *
 * Cloud Functionsの実行環境のタイムゾーンはUTCだが、読むのは日本にいる利用者なので
 * 表示だけJSTに寄せ、末尾に基準を明記する。
 */
const formatSignedInAt = (signedInAt: Date): string => {
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(signedInAt);

  return `${formatted} (JST)`;
};

/** 値が空のときに「取得できなかった」と分かるようにする。空欄のままだと欠落に気づけない */
const orUnknown = (value: string): string => (value === "" ? "(取得できませんでした)" : value);

/**
 * 通知メールを組み立てる。
 *
 * 開発環境からの通知には件名に`[dev]`を付ける。件名だけで振り分けられるようにするため。
 */
export const buildLoginNotificationMail = (
  context: LoginNotificationContext,
): LoginNotificationMail => {
  const isProd = context.projectId === PROD_PROJECT_ID;
  const client = describeClient(context.userAgent);

  const subject = isProd
    ? `[FIRE-FIRE] ログインがありました (${context.signInMethod})`
    : `[FIRE-FIRE][dev] ログインがありました (${context.signInMethod})`;

  const lines = [
    "FIRE-FIREへのログインがありました。",
    "",
    `日時: ${formatSignedInAt(context.signedInAt)}`,
    `ログイン方法: ${context.signInMethod}`,
    `IPアドレス: ${orUnknown(context.ipAddress)}`,
    `ブラウザ: ${client ?? "判別できませんでした"}`,
    `User-Agent: ${orUnknown(context.userAgent)}`,
    "",
    "心当たりがない場合は、パスワードを変更し、2段階認証を再設定してください。",
  ];

  if (!isProd) {
    lines.push(
      "",
      `※ これは開発環境からの通知です (プロジェクト: ${orUnknown(context.projectId)})。`,
    );
  }

  return { subject, text: `${lines.join("\n")}\n` };
};
