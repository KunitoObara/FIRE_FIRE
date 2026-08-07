import { describe, expect, it } from "vitest";

import { filterSeriesByPeriod } from "@/lib/dashboard/period";

const NOW = new Date("2026-07-31T00:00:00.000Z");

const series: NetWorthPoint[] = [
  { date: "2019-01-01", amount: 1_000_000 },
  { date: "2021-07-31", amount: 2_000_000 },
  { date: "2023-07-31", amount: 3_000_000 },
  { date: "2025-07-31", amount: 4_000_000 },
  { date: "2026-07-01", amount: 5_000_000 },
];

const datesOf = (points: NetWorthPoint[]): string[] => points.map((point) => point.date);

describe("filterSeriesByPeriod", () => {
  it("1年を選ぶと直近1年分だけを残す", () => {
    expect(datesOf(filterSeriesByPeriod(series, "1y", NOW))).toEqual(["2025-07-31", "2026-07-01"]);
  });

  it("3年を選ぶと直近3年分だけを残す", () => {
    expect(datesOf(filterSeriesByPeriod(series, "3y", NOW))).toEqual([
      "2023-07-31",
      "2025-07-31",
      "2026-07-01",
    ]);
  });

  it("5年を選ぶと直近5年分だけを残す", () => {
    expect(datesOf(filterSeriesByPeriod(series, "5y", NOW))).toEqual([
      "2021-07-31",
      "2023-07-31",
      "2025-07-31",
      "2026-07-01",
    ]);
  });

  it("全期間は絞り込まない", () => {
    expect(datesOf(filterSeriesByPeriod(series, "all", NOW))).toEqual(datesOf(series));
  });

  /** 境界の点を落とすと、期間を切り替えたときにグラフの左端が1点欠ける */
  it("ちょうどN年前の点は含める", () => {
    const boundary: NetWorthPoint[] = [{ date: "2025-07-31", amount: 1 }];

    expect(filterSeriesByPeriod(boundary, "1y", NOW)).toHaveLength(1);
  });

  it("N年前より1日でも古い点は含めない", () => {
    const justOutside: NetWorthPoint[] = [{ date: "2025-07-30", amount: 1 }];

    expect(filterSeriesByPeriod(justOutside, "1y", NOW)).toHaveLength(0);
  });

  it("データが無ければ空のまま返す", () => {
    expect(filterSeriesByPeriod([], "1y", NOW)).toEqual([]);
  });
});
