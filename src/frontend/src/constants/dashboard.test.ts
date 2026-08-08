import { describe, expect, it } from "vitest";

import { buildBreakdownKey, buildNetWorthSeriesKey } from "@/constants/dashboard";

/**
 * 登場アニメーションの再生の引き金(DESIGN.md 9章)。
 *
 * 再生するのは「そのグラフ自身のデータが変わったとき」だけで、ホバー・リサイズ・
 * 同じデータのままの再取得では再生しない。その判定をこの署名が担っている。
 */

const series: NetWorthPoint[] = [
  { date: "2026-07-31", amount: 11_000_000 },
  { date: "2026-08-05", amount: 11_400_000 },
];

const slices: AssetBreakdownSlice[] = [
  {
    categoryId: "株式(現物)",
    name: "株式(現物)",
    amount: 5_400_000,
    ratio: 0.77,
    color: "var(--chart-1)",
  },
  {
    categoryId: "投資信託",
    name: "投資信託",
    amount: 1_600_000,
    ratio: 0.23,
    color: "var(--chart-2)",
  },
];

describe("buildNetWorthSeriesKey", () => {
  /** 表示データは取得のたびに組み立て直されるため、配列の参照では判定できない */
  it("中身が同じなら、別インスタンスでも同じ署名になる", () => {
    expect(buildNetWorthSeriesKey("総資産", series)).toBe(
      buildNetWorthSeriesKey("総資産", [...series.map((point) => ({ ...point }))]),
    );
  });

  it("分類軸を切り替えると署名が変わる", () => {
    expect(buildNetWorthSeriesKey("投資性資産", series)).not.toBe(
      buildNetWorthSeriesKey("総資産", series),
    );
  });

  it("表示期間の切替で点の範囲が変わると署名が変わる", () => {
    expect(buildNetWorthSeriesKey("総資産", series.slice(1))).not.toBe(
      buildNetWorthSeriesKey("総資産", series),
    );
  });

  /** CSVを取り込み直して直近の残高だけが変わった場合(日付も件数も同じ) */
  it("直近の金額が変わると署名が変わる", () => {
    const reimported = series.map((point, index) =>
      index === series.length - 1 ? { ...point, amount: 12_000_000 } : point,
    );

    expect(buildNetWorthSeriesKey("総資産", reimported)).not.toBe(
      buildNetWorthSeriesKey("総資産", series),
    );
  });

  it("点が1つも無くても署名を作れる", () => {
    expect(buildNetWorthSeriesKey("総資産", [])).toBe(buildNetWorthSeriesKey("総資産", []));
  });
});

describe("buildBreakdownKey", () => {
  it("中身が同じなら、別インスタンスでも同じ署名になる", () => {
    expect(buildBreakdownKey("総資産", slices)).toBe(
      buildBreakdownKey("総資産", [...slices.map((slice) => ({ ...slice }))]),
    );
  });

  it("分類軸を切り替えると署名が変わる", () => {
    expect(buildBreakdownKey("投資性資産", slices)).not.toBe(buildBreakdownKey("総資産", slices));
  });

  it("分類の金額が変わると署名が変わる", () => {
    const updated = slices.map((slice, index) =>
      index === 0 ? { ...slice, amount: 6_000_000 } : slice,
    );

    expect(buildBreakdownKey("総資産", updated)).not.toBe(buildBreakdownKey("総資産", slices));
  });

  it("分類が増減すると署名が変わる", () => {
    expect(buildBreakdownKey("総資産", slices.slice(0, 1))).not.toBe(
      buildBreakdownKey("総資産", slices),
    );
  });
});
