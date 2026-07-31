import { describe, expect, it } from "vitest";

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
