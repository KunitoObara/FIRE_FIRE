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

/**
 * 表示切替(積み上げ / 純資産)も署名の一部だが、ここで確かめたいのはデータ側の変化なので
 * 既定を積み上げに固定して呼ぶ。表示切替そのものは専用のテストで見る。
 */
const seriesKey = (
  axisName: string,
  points: NetWorthPoint[],
  mode: NetWorthTrendModeId = "with-debt",
): string => buildNetWorthSeriesKey(axisName, points, mode);

const point = (
  date: string,
  amount: number,
  byType: Record<string, number> = {},
  debtBalance = 0,
): NetWorthPoint => ({
  date,
  amount,
  byType,
  debtBalance,
  propertyAmount: 0,
});

const series: NetWorthPoint[] = [point("2026-07-31", 11_000_000), point("2026-08-05", 11_400_000)];

const slices: AssetBreakdownSlice[] = [
  {
    categoryId: "株式(現物)",
    name: "株式(現物)",
    amount: 5_400_000,
    ratio: 0.77,
    color: "var(--chart-1)",
    riskLevel: null,
  },
  {
    categoryId: "投資信託",
    name: "投資信託",
    amount: 1_600_000,
    ratio: 0.23,
    color: "var(--chart-2)",
    riskLevel: null,
  },
];

/**
 * 円グラフのスイープはCSS(`CategoryBreakdownChart.module.css`)側にも同じ再生時間・
 * イージングを書いており、CSSからTypeScriptの定数を読めないぶん値が二重になっている。
 *
 * 片方だけ変えると、同じ画面の中で円グラフだけ別の速さで動く。lintも型検査も気付けないので、
 * CSSを文字列として読んで値が一致していることをここで確かめる。
 */
describe.each([
  ["分類別内訳", "CategoryBreakdownChart", "category-breakdown"],
  ["費目別支出", "ExpenseBreakdownChart", "expense-breakdown"],
])("グラフの再生時間・イージング(%s)", (_label, componentName, propertyNamePart) => {
  // vitestの実行時のカレントディレクトリは`src/frontend`(vitest.config.ts の root)
  const moduleCss = readFileSync(
    resolve(process.cwd(), `src/components/dashboard/${componentName}.module.css`),
    "utf8",
  );

  it("CSSの再生時間が定数と一致している", () => {
    expect(moduleCss).toContain(`${CHART_ANIMATION_DURATION_MS}ms`);
  });

  it("CSSのイージングが定数と一致している", () => {
    expect(moduleCss).toContain(CHART_ANIMATION_EASING);
  });

  /**
   * `@property`で宣言した名前と、実際に animate / 参照している名前が一致していること。
   *
   * 片方だけ改名しても、CSSとしては妥当なまま**補間だけが静かに止まる**(型の無い
   * カスタムプロパティとして扱われ、0deg→360degが一足飛びに切り替わる)。lintも型検査も
   * テストの他のケースも気付けないので、対応関係そのものをここで固定する。
   */
  it("@propertyで宣言した名前を、keyframesとマスクの両方が参照している", () => {
    const declared = /@property\s+(--[\w-]+)/u.exec(moduleCss)?.[1];

    expect(declared).toBeDefined();
    // `from { --x: 0deg }` の側
    expect(moduleCss).toContain(`${declared}: 0deg`);
    // マスクが読む側
    expect(moduleCss).toContain(`var(${declared})`);
  });

  /**
   * `@property`はCSS Moduleの中でもグローバルに登録されるため、名前にコンポーネント名を
   * 含める(CODING_STANDARDS.md 6章)。他のコンポーネントが同名で再宣言すると
   * `initial-value`が上書きされ、視差軽減の設定時に円グラフが欠けて見える形で壊れる。
   */
  it("@propertyの名前にコンポーネント名が含まれている", () => {
    const declared = /@property\s+(--[\w-]+)/u.exec(moduleCss)?.[1];

    expect(declared).toContain(propertyNamePart);
  });
});

/**
 * 2つの円グラフのCSS Moduleが**別々の`@property`名**を使っていること。
 *
 * `@property`はCSS Moduleの中で書いてもスコープを持たずグローバルに登録されるため、
 * 同じ名前を2つのコンポーネントが宣言すると、後から読み込まれた方の`initial-value`で
 * 上書きされる。`initial-value: 360deg`が別の値に変わると、視差効果を減らす設定のときに
 * 「全面が見えた状態」にならず、**円グラフが欠けて見える**形で壊れる。lint・型検査・
 * 各モジュール単体のテストのいずれでも検出できない衝突なので、名前が違うことを直接見る。
 */
it("2つの円グラフが同じ@property名を宣言していない", () => {
  const declaredName = (componentName: string): string | undefined => {
    const css = readFileSync(
      resolve(process.cwd(), `src/components/dashboard/${componentName}.module.css`),
      "utf8",
    );

    return /@property\s+(--[\w-]+)/u.exec(css)?.[1];
  };

  expect(declaredName("CategoryBreakdownChart")).not.toBe(declaredName("ExpenseBreakdownChart"));
});

describe("buildNetWorthSeriesKey", () => {
  /** 表示データは取得のたびに組み立て直されるため、配列の参照では判定できない */
  it("中身が同じなら、別インスタンスでも同じ署名になる", () => {
    expect(seriesKey("総資産", series)).toBe(
      seriesKey("総資産", [...series.map((point) => ({ ...point }))]),
    );
  });

  it("分類軸を切り替えると署名が変わる", () => {
    expect(seriesKey("投資性資産", series)).not.toBe(seriesKey("総資産", series));
  });

  it("表示期間の切替で点の範囲が変わると署名が変わる", () => {
    expect(seriesKey("総資産", series.slice(1))).not.toBe(seriesKey("総資産", series));
  });

  /**
   * CSVを取り込み直して途中の月の残高だけが訂正された場合。
   * 件数も両端も変わらないため、両端だけを見る署名では線の形の変化を取りこぼす。
   */
  it("途中の点の金額が変わると署名が変わる", () => {
    const corrected = [
      point("2026-06-30", 10_000_000),
      point("2026-07-31", 10_500_000),
      point("2026-08-05", 11_400_000),
    ];
    const original = [
      point("2026-06-30", 10_000_000),
      point("2026-07-31", 11_000_000),
      point("2026-08-05", 11_400_000),
    ];

    expect(seriesKey("総資産", corrected)).not.toBe(seriesKey("総資産", original));
  });

  /** CSVを取り込み直して直近の残高だけが変わった場合(日付も件数も同じ) */
  it("直近の金額が変わると署名が変わる", () => {
    const reimported = series.map((point, index) =>
      index === series.length - 1 ? { ...point, amount: 12_000_000 } : point,
    );

    expect(seriesKey("総資産", reimported)).not.toBe(seriesKey("総資産", series));
  });

  it("点が1つも無くても署名を作れる", () => {
    expect(seriesKey("総資産", [])).toBe(seriesKey("総資産", []));
  });

  /**
   * 積み上げ表示は資産種別ごとの帯を描くので、純額が同じでも内訳の配分が変われば
   * 絵が変わる。純額だけを署名にしていると、この取込直しで再生が漏れる。
   */
  it("純額が同じで内訳の配分だけが変わると署名が変わる", () => {
    const before = [point("2026-08-05", 1_000_000, { 現金: 600_000, 投資信託: 400_000 })];
    const after = [point("2026-08-05", 1_000_000, { 現金: 400_000, 投資信託: 600_000 })];

    expect(seriesKey("総資産", after)).not.toBe(seriesKey("総資産", before));
  });

  /**
   * `byType`はFirestoreのマップをそのまま持つので、同じ中身でも取得のたびにキーの順が
   * 変わりうる。順のまま署名にすると、裏での取り直しだけで再生してしまう
   * (DESIGN.md 9章が再生しないと定めているケース)。
   */
  it("内訳のキーの順が違うだけなら同じ署名になる", () => {
    const left = [point("2026-08-05", 1_000_000, { 現金: 600_000, 投資信託: 400_000 })];
    const right = [point("2026-08-05", 1_000_000, { 投資信託: 400_000, 現金: 600_000 })];

    expect(seriesKey("総資産", right)).toBe(seriesKey("総資産", left));
  });

  /** 切替は帯の構成が入れ替わるので、切り替えた先を最初から描く(DESIGN.md 9章) */
  it("負債反映を切り替えると署名が変わる", () => {
    expect(seriesKey("総資産", series, "assets-only")).not.toBe(
      seriesKey("総資産", series, "with-debt"),
    );
  });

  /**
   * 負債の帯は`debtBalance`から描くので、資産が同じまま負債だけが更新された保存でも
   * 絵が変わる。残債を署名に含めないと、この取込直し(B11の保存)で再生が漏れる。
   */
  it("資産が同じで残債だけが変わると署名が変わる", () => {
    const repaid = series.map((point, index) =>
      index === series.length - 1 ? { ...point, debtBalance: 1_000_000 } : point,
    );

    expect(seriesKey("総資産", repaid)).not.toBe(seriesKey("総資産", series));
  });

  /**
   * 不動産の帯は`propertyAmount`から描く。純額(`amount`)は不動産と負債の増減が相殺すると
   * 変わらないので、これを署名に含めないと帯の形が変わったのに再生が漏れる(残債と同じ性質)。
   */
  it("純額が同じでも不動産と残債の内訳が変わると署名が変わる", () => {
    const shifted = series.map((point, index) =>
      index === series.length - 1
        ? { ...point, propertyAmount: 5_000_000, debtBalance: point.debtBalance + 5_000_000 }
        : point,
    );

    // 純額は据え置き(不動産 +5,000,000 と残債 +5,000,000 が相殺する)
    expect(shifted.at(-1)?.amount).toBe(series.at(-1)?.amount);
    expect(seriesKey("総資産", shifted)).not.toBe(seriesKey("総資産", series));
  });
});

/**
 * 分類軸名はB4でユーザーが付け、資産種別名はCSVの列名がそのまま入る。
 * どちらも自由入力に近いので、区切り文字を値に含む名前で署名が衝突しないことを確かめる。
 */
describe("署名に使う名前が区切り文字を含む場合", () => {
  it("分類軸名に区切り文字が入っていても、別のデータが同じ署名にならない", () => {
    const left = seriesKey('投資性資産","x', [point("2026-08-05", 1)]);
    const right = seriesKey("投資性資産", [point('","x', 0), point("2026-08-05", 1)]);

    expect(left).not.toBe(right);
  });

  it("資産種別名に区切り文字が入っていても、別のデータが同じ署名にならない", () => {
    const slice = (categoryId: string, amount: number): AssetBreakdownSlice => ({
      categoryId,
      name: categoryId,
      amount,
      ratio: 1,
      color: "var(--chart-1)",
      riskLevel: null,
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
