import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildBreakdownKey,
  buildNetWorthSeriesKey,
  CHART_ANIMATION_DURATION_MS,
  CHART_ANIMATION_EASING,
} from "@/constants/dashboard";

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

/**
 * 円グラフのスイープはCSS(`CategoryBreakdownChart.module.css`)側にも同じ再生時間・
 * イージングを書いており、CSSからTypeScriptの定数を読めないぶん値が二重になっている。
 *
 * 片方だけ変えると、同じ画面の中で円グラフだけ別の速さで動く。lintも型検査も気付けないので、
 * CSSを文字列として読んで値が一致していることをここで確かめる。
 */
describe("グラフの再生時間・イージング", () => {
  // vitestの実行時のカレントディレクトリは`src/frontend`(vitest.config.ts の root)
  const moduleCss = readFileSync(
    resolve(process.cwd(), "src/components/dashboard/CategoryBreakdownChart.module.css"),
    "utf8",
  );

  it("CSSの再生時間が定数と一致している", () => {
    expect(moduleCss).toContain(`${CHART_ANIMATION_DURATION_MS}ms`);
  });

  it("CSSのイージングが定数と一致している", () => {
    expect(moduleCss).toContain(CHART_ANIMATION_EASING);
  });
});

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

  /**
   * CSVを取り込み直して途中の月の残高だけが訂正された場合。
   * 件数も両端も変わらないため、両端だけを見る署名では線の形の変化を取りこぼす。
   */
  it("途中の点の金額が変わると署名が変わる", () => {
    const corrected = [
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 10_500_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ];
    const original = [
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ];

    expect(buildNetWorthSeriesKey("総資産", corrected)).not.toBe(
      buildNetWorthSeriesKey("総資産", original),
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

/**
 * 分類軸名はB4でユーザーが付け、資産種別名はCSVの列名がそのまま入る。
 * どちらも自由入力に近いので、区切り文字を値に含む名前で署名が衝突しないことを確かめる。
 */
describe("署名に使う名前が区切り文字を含む場合", () => {
  it("分類軸名に区切り文字が入っていても、別のデータが同じ署名にならない", () => {
    const left = buildNetWorthSeriesKey('投資性資産","x', [{ date: "2026-08-05", amount: 1 }]);
    const right = buildNetWorthSeriesKey("投資性資産", [
      { date: '","x', amount: 0 },
      { date: "2026-08-05", amount: 1 },
    ]);

    expect(left).not.toBe(right);
  });

  it("資産種別名に区切り文字が入っていても、別のデータが同じ署名にならない", () => {
    const slice = (categoryId: string, amount: number): AssetBreakdownSlice => ({
      categoryId,
      name: categoryId,
      amount,
      ratio: 1,
      color: "var(--chart-1)",
    });

    expect(buildBreakdownKey("総資産", [slice('株式","1', 2)])).not.toBe(
      buildBreakdownKey("総資産", [slice("株式", 1), slice("", 2)]),
    );
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
