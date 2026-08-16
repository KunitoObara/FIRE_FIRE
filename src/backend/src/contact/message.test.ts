import { describe, expect, it } from "vitest";

import { buildContactMail } from "./message";

/**
 * 受け取るのは開発者本人だけなので、確かめるのは**読めること**と
 * **どの環境から来たか分かること**の2つ(docs/screen-requirements-public.md A11)。
 */

const input = { email: "taro.yamada@example.com", body: "取込がうまくいきません。" };
const receivedAt = new Date("2026-08-15T03:04:05Z");

describe("buildContactMail", () => {
  it("返信先・受信日時・本文を載せる", () => {
    const mail = buildContactMail(input, "fire-fire-prod", receivedAt);

    expect(mail.text).toContain("返信先: taro.yamada@example.com");
    expect(mail.text).toContain("取込がうまくいきません。");
    // 実行環境はUTCだが、読むのは日本にいる人なので表示はJSTに寄せる
    expect(mail.text).toContain("2026/08/15 12:04:05(日本時間)");
  });

  it("本番からの送信には環境の印を付けない", () => {
    expect(buildContactMail(input, "fire-fire-prod", receivedAt).subject).toBe(
      "FIRE-FIRE お問い合わせ",
    );
  });

  /** ローカル開発もSTGのFirebaseに直結しており、印が無いと受信箱で本番と混ざる */
  it("本番以外からの送信には[dev]を付ける", () => {
    expect(buildContactMail(input, "fire-fire-dev", receivedAt).subject).toBe(
      "[dev] FIRE-FIRE お問い合わせ",
    );
  });

  it("プロジェクトIDが分からない場合も本番以外として扱う", () => {
    const mail = buildContactMail(input, "", receivedAt);

    expect(mail.subject).toBe("[dev] FIRE-FIRE お問い合わせ");
    expect(mail.text).toContain("プロジェクト: (不明)");
  });

  /**
   * 件名に本文を混ぜると、受信箱の一覧に他人が書いた文章がそのまま並ぶ。
   * 長さも内容も選べないため、件名は固定にしてある。
   */
  it("件名に本文を混ぜない", () => {
    const mail = buildContactMail(
      { email: input.email, body: "件名に出したい文言" },
      "fire-fire-prod",
      receivedAt,
    );

    expect(mail.subject).not.toContain("件名に出したい文言");
  });
});
