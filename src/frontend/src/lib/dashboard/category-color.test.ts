import { describe, expect, it } from "vitest";

import { DEBT_CATEGORY_COLOR, DEBT_CATEGORY_ID, DEBT_CATEGORY_NAME } from "@/constants/dashboard";
import { buildBreakdownSlices } from "@/lib/dashboard/category-color";

/** 分類マスタ(B4)を模したもの。並び順が色の割り当て順になる */
const categories: AssetCategory[] = [
  { id: "fund", name: "投資信託" },
  { id: "deposit", name: "現金・預金" },
  { id: "stock", name: "株式" },
];

describe("buildBreakdownSlices", () => {
  it("分類マスタの登録順に、登録順のスロットの色を割り当てる", () => {
    const slices = buildBreakdownSlices(
      [
        { categoryId: "stock", amount: 100 },
        { categoryId: "fund", amount: 300 },
        { categoryId: "deposit", amount: 100 },
      ],
      categories,
    );

    expect(slices.map((slice) => [slice.name, slice.color])).toEqual([
      ["投資信託", "var(--chart-1)"],
      ["現金・預金", "var(--chart-2)"],
      ["株式", "var(--chart-3)"],
    ]);
  });

  /**
   * 金額順に色を振ると、分類軸や期間を切り替えて順位が入れ替わるたびに同じ分類の色が変わり、
   * グラフを見比べられなくなる。色は分類そのものに紐づける(DESIGN.md 3章)。
   */
  it("金額の大小が変わっても分類ごとの色は変わらない", () => {
    const before = buildBreakdownSlices(
      [
        { categoryId: "fund", amount: 900 },
        { categoryId: "stock", amount: 100 },
      ],
      categories,
    );
    const after = buildBreakdownSlices(
      [
        { categoryId: "fund", amount: 100 },
        { categoryId: "stock", amount: 900 },
      ],
      categories,
    );

    const colorOf = (slices: AssetBreakdownSlice[], categoryId: string): string | undefined =>
      slices.find((slice) => slice.categoryId === categoryId)?.color;

    expect(colorOf(before, "fund")).toBe(colorOf(after, "fund"));
    expect(colorOf(before, "stock")).toBe(colorOf(after, "stock"));
  });

  it("構成比は合計に対する割合で返す", () => {
    const slices = buildBreakdownSlices(
      [
        { categoryId: "fund", amount: 750 },
        { categoryId: "deposit", amount: 250 },
      ],
      categories,
    );

    expect(slices.map((slice) => slice.ratio)).toEqual([0.75, 0.25]);
  });

  it("合計が0でも構成比を0として返す(0除算にしない)", () => {
    const slices = buildBreakdownSlices([{ categoryId: "fund", amount: 0 }], categories);

    expect(slices[0]?.ratio).toBe(0);
  });

  it("分類が無ければ空を返す", () => {
    expect(buildBreakdownSlices([], categories)).toEqual([]);
  });

  describe("色のスロットに収まらない場合", () => {
    /** `globals.css`の`--chart-1`〜`--chart-8`と同じ数 */
    const manyCategories: AssetCategory[] = Array.from({ length: 10 }, (_, index) => ({
      id: `category-${index}`,
      name: `分類${index}`,
    }));
    const manyEntries: AssetBreakdownEntry[] = manyCategories.map((category) => ({
      categoryId: category.id,
      amount: 100,
    }));

    it("8色に収まらない分は「その他」にまとめる", () => {
      const slices = buildBreakdownSlices(manyEntries, manyCategories);

      expect(slices).toHaveLength(8);
      expect(slices.at(-1)?.name).toBe("その他");
      // 先頭7分類が個別の色を持ち、残り3分類が「その他」に入る
      expect(slices.at(-1)?.amount).toBe(300);
      expect(slices.at(-1)?.color).toBe("var(--chart-8)");
    });

    it("ちょうど8分類なら「その他」を作らず全て個別の色にする", () => {
      const eight = manyCategories.slice(0, 8);
      const slices = buildBreakdownSlices(manyEntries.slice(0, 8), eight);

      expect(slices).toHaveLength(8);
      expect(slices.map((slice) => slice.color)).toEqual(
        Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`),
      );
    });
  });

  /** B4で分類を削除した後も、取込済みデータ側には古い分類IDが残りうる */
  it("分類マスタに無いIDのデータは「その他」にまとめる", () => {
    const slices = buildBreakdownSlices(
      [
        { categoryId: "fund", amount: 700 },
        { categoryId: "deleted", amount: 300 },
      ],
      categories,
    );

    expect(slices.map((slice) => slice.name)).toEqual(["投資信託", "その他"]);
    expect(slices.at(-1)?.amount).toBe(300);
  });
});

/**
 * 負債のスライス(DESIGN.md 3章、docs/screen-requirements-dashboard.md B1)。
 * 資産分類カラーのスロットを使わず、専用の固定色を持つ1スライスとして最後に足す。
 */
describe("buildBreakdownSlices(負債)", () => {
  const debtCategories: AssetCategory[] = [
    { id: "株式(現物)", name: "株式(現物)" },
    { id: "預金・現金", name: "預金・現金" },
  ];

  const debtEntries: AssetBreakdownEntry[] = [
    { categoryId: "株式(現物)", amount: 6_000_000 },
    { categoryId: "預金・現金", amount: 4_000_000 },
  ];

  it("負債を最後のスライスとして足し、資産分類のスロットは消費しない", () => {
    const slices = buildBreakdownSlices(debtEntries, debtCategories, 2_000_000);

    expect(slices.map((slice) => slice.categoryId)).toEqual([
      "株式(現物)",
      "預金・現金",
      DEBT_CATEGORY_ID,
    ]);
    expect(slices[0]?.color).toBe("var(--chart-1)");
    expect(slices[1]?.color).toBe("var(--chart-2)");
    expect(slices[2]?.color).toBe(DEBT_CATEGORY_COLOR);
  });

  /** 円グラフは正の面積でしか比を表せないため、分母は純額ではなく資産+負債になる */
  it("構成比の分母は「資産合計 + 負債合計」になる", () => {
    const slices = buildBreakdownSlices(debtEntries, debtCategories, 2_000_000);

    expect(slices.map((slice) => slice.ratio)).toEqual([0.5, 1 / 3, 1 / 6]);
  });

  /** 0円のスライスは凡例を埋めるだけになる(0円以下の資産種別を除いているのと同じ理由) */
  it("負債の残債合計が0円ならスライスを出さない", () => {
    expect(
      buildBreakdownSlices(debtEntries, debtCategories, 0).map((slice) => slice.categoryId),
    ).not.toContain(DEBT_CATEGORY_ID);
  });

  /** 表示名との一致で判定すると、「負債」という名前の資産種別と衝突する */
  it("負債のスライスは擬似的な分類IDで表す", () => {
    const slices = buildBreakdownSlices(debtEntries, debtCategories, 2_000_000);

    expect(slices.at(-1)?.categoryId).toBe(DEBT_CATEGORY_ID);
    expect(slices.at(-1)?.name).toBe(DEBT_CATEGORY_NAME);
  });
});
