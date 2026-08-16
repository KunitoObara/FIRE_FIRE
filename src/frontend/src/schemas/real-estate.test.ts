import { describe, expect, it } from "vitest";

import {
  REAL_ESTATE_ACQUIRED_ON_FORMAT_MESSAGE,
  REAL_ESTATE_ACQUIRED_ON_FUTURE_MESSAGE,
  REAL_ESTATE_ACQUIRED_ON_TOO_OLD_MESSAGE,
} from "@/constants/real-estate";
import { realEstatePropertyDocumentSchema, validateAcquiredOn } from "@/schemas/real-estate";

/**
 * 取得年月の検証(docs/screen-requirements-real-estate.md B7「入力の制約」)と、
 * 物件ドキュメントのパース。
 *
 * B11の発生年月と同じ規則で揃えてある。当月の判定に端末の日付を使うため、
 * 「いま」をテストから渡せる形にしてある。
 */

const NOW = new Date("2026-08-13T00:00:00+09:00");

describe("validateAcquiredOn", () => {
  it("未入力は任意入力としてエラーにしない", () => {
    expect(validateAcquiredOn("", NOW)).toBeNull();
  });

  it("当月は入力できる", () => {
    expect(validateAcquiredOn("2026-08", NOW)).toBeNull();
  });

  /** まだ取得していない物件を過去のグラフに積まないため */
  it("当月より後はエラーにする", () => {
    expect(validateAcquiredOn("2026-09", NOW)).toBe(REAL_ESTATE_ACQUIRED_ON_FUTURE_MESSAGE);
  });

  it("下限より前はエラーにする", () => {
    expect(validateAcquiredOn("1899-12", NOW)).toBe(REAL_ESTATE_ACQUIRED_ON_TOO_OLD_MESSAGE);
  });

  /**
   * 桁だけを見る形にすると`2020-13`が通り、当月との比較も文字列の辞書順なので保存まで
   * 素通りする。月は01〜12だけを通す(`firestore.rules`側にも同じ形を置いてある)。
   */
  it("実在しない月はエラーにする", () => {
    expect(validateAcquiredOn("2020-13", NOW)).toBe(REAL_ESTATE_ACQUIRED_ON_FORMAT_MESSAGE);
  });

  it("年月として読めない値はエラーにする", () => {
    expect(validateAcquiredOn("2020/04", NOW)).toBe(REAL_ESTATE_ACQUIRED_ON_FORMAT_MESSAGE);
  });
});

describe("realEstatePropertyDocumentSchema", () => {
  const stored = {
    name: "〇〇マンション101号室",
    location: "東京都渋谷区神南1-2-3",
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
    rental: null,
    updatedAt: "2026-06-01",
    createdAt: null,
  };

  /**
   * B4-8より前に登録された物件は取得年月も履歴も持たない。欠損で落とすと、既存の物件が
   * B5〜B7から一斉に「解釈できない物件」になる(`categoryAxes.debtIds`と同じ理由で既定へ倒す)。
   */
  it("取得年月と履歴を持たない既存の物件も読める", () => {
    const parsed = realEstatePropertyDocumentSchema.parse(stored);

    expect(parsed.acquiredOn).toBeNull();
    expect(parsed.valueHistory).toEqual({});
  });

  it("履歴は日付をキーに時価とローン残高を組で持つ", () => {
    const parsed = realEstatePropertyDocumentSchema.parse({
      ...stored,
      acquiredOn: "2019-04",
      valueHistory: { "2026-06-01": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
    });

    expect(parsed.valueHistory["2026-06-01"]).toEqual({
      marketValue: 32_000_000,
      loanBalance: 18_400_000,
    });
  });

  /**
   * 資産推移グラフは履歴のキーを資産残高の集計日と文字列のまま比較する(`yyyy-MM-dd`は
   * 辞書順=時系列)。形が崩れた記録が混じると、過去の点が黙って別の日に効く。
   */
  it("キーが日付の形になっていない履歴は弾く", () => {
    const parsed = realEstatePropertyDocumentSchema.safeParse({
      ...stored,
      valueHistory: { "2026-6-1": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
    });

    expect(parsed.success).toBe(false);
  });
});
