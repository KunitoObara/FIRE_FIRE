import { describe, expect, it } from "vitest";

import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  collectAssetCategories,
  sumAxisAmount,
} from "@/lib/dashboard/aggregation";

/**
 * マネーフォワードの「資産推移」の形に合わせ、当月は日次・それ以前は月末日のみにしてある。
 */
const latestSnapshot: AssetSnapshot = {
  date: "2026-08-05",
  total: 11_400_000,
  byType: { "預金・現金": 4_400_000, "株式(現物)": 5_400_000, 投資信託: 1_600_000 },
};

const snapshots: AssetSnapshot[] = [
  {
    date: "2026-06-30",
    total: 10_000_000,
    byType: { "預金・現金": 4_000_000, "株式(現物)": 5_000_000, 投資信託: 1_000_000 },
  },
  {
    date: "2026-07-31",
    total: 11_000_000,
    byType: { "預金・現金": 4_200_000, "株式(現物)": 5_300_000, 投資信託: 1_500_000 },
  },
  {
    date: "2026-08-01",
    total: 11_100_000,
    byType: { "預金・現金": 4_300_000, "株式(現物)": 5_300_000, 投資信託: 1_500_000 },
  },
  latestSnapshot,
];

describe("sumAxisAmount", () => {
  it("集計対象の資産種別だけを合計する", () => {
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "投資信託"])).toBe(7_000_000);
  });

  /** 空配列は「すべての資産種別が対象」を意味する(B4) */
  it("集計対象が空配列なら全種別を合計する", () => {
    expect(sumAxisAmount(latestSnapshot, [])).toBe(11_400_000);
  });

  it("その日に存在しない資産種別が指定されていても無視する", () => {
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "暗号資産"])).toBe(5_400_000);
  });

  it("対象が1件も残らなければ0を返す", () => {
    expect(sumAxisAmount(latestSnapshot, ["暗号資産"])).toBe(0);
  });
});

describe("buildAxisNetWorthSeries", () => {
  /** 当月の日次が並ぶと、月次の目盛り・ツールチップと1対1で対応しなくなる */
  it("月ごとに、その月でいちばん新しい集計日の残高を1点にする", () => {
    expect(buildAxisNetWorthSeries(snapshots, [])).toEqual([
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ]);
  });

  it("集計対象の資産種別だけで各月の金額を出す", () => {
    expect(buildAxisNetWorthSeries(snapshots, ["投資信託"])).toEqual([
      { date: "2026-06-30", amount: 1_000_000 },
      { date: "2026-07-31", amount: 1_500_000 },
      { date: "2026-08-05", amount: 1_600_000 },
    ]);
  });

  it("入力の並び順によらず日付の昇順で返す", () => {
    expect(
      buildAxisNetWorthSeries([...snapshots].reverse(), []).map((point) => point.date),
    ).toEqual(["2026-06-30", "2026-07-31", "2026-08-05"]);
  });

  it("資産残高が1件も無ければ空配列を返す", () => {
    expect(buildAxisNetWorthSeries([], [])).toEqual([]);
  });
});

describe("buildAxisBreakdown", () => {
  it("直近の資産残高を、集計対象の資産種別ごとの金額にする", () => {
    expect(buildAxisBreakdown(latestSnapshot, ["株式(現物)", "投資信託"])).toEqual([
      { categoryId: "株式(現物)", amount: 5_400_000 },
      { categoryId: "投資信託", amount: 1_600_000 },
    ]);
  });

  it("集計対象が空配列なら全種別を内訳にする", () => {
    expect(buildAxisBreakdown(latestSnapshot, [])).toHaveLength(3);
  });

  /** 0円のスライスは構成比を持たず、凡例を埋めるだけになる */
  it("0円以下の資産種別は内訳に含めない", () => {
    const snapshot: AssetSnapshot = {
      date: "2026-08-05",
      total: 5_400_000,
      byType: { "株式(現物)": 5_400_000, ポイント: 0, 暗号資産: -1_000 },
    };

    expect(buildAxisBreakdown(snapshot, [])).toEqual([
      { categoryId: "株式(現物)", amount: 5_400_000 },
    ]);
  });
});

describe("collectAssetCategories", () => {
  /**
   * 並び順がそのまま色スロットになるため、分類軸や金額で変わらない基準
   * (B4の集計対象の選択肢と同じ日本語の名前順)に固定する
   */
  it("直近の資産残高の資産種別を名前順に並べる", () => {
    expect(collectAssetCategories(latestSnapshot)).toEqual([
      { id: "株式(現物)", name: "株式(現物)" },
      { id: "投資信託", name: "投資信託" },
      { id: "預金・現金", name: "預金・現金" },
    ]);
  });

  it("資産残高が無ければ空配列を返す", () => {
    expect(collectAssetCategories(undefined)).toEqual([]);
  });
});
