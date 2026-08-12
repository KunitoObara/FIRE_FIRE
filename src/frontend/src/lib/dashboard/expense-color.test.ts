import { describe, expect, it } from "vitest";

import { buildExpenseSlices } from "@/lib/dashboard/expense-color";

const expense = (name: string, amount: number): ExpenseByCategory => ({ name, amount });

/**
 * 費目別支出の色と構成比(docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。
 *
 * 費目マスタは持たない(docs/transaction-import-requirements.md 6章)ので、資産分類のような
 * 「登録順」が無い。並びは費目名の順で決める。
 */
describe("buildExpenseSlices", () => {
  it("費目名の順に色スロットを割り当てる", () => {
    const slices = buildExpenseSlices([
      expense("食費", 62_400),
      expense("交通費", 21_000),
      expense("住居費", 97_000),
    ]);

    expect(slices.map((slice) => [slice.name, slice.color])).toEqual([
      ["交通費", "var(--chart-1)"],
      ["住居費", "var(--chart-2)"],
      ["食費", "var(--chart-3)"],
    ]);
  });

  /**
   * 金額順に配ると、月ごとに順位が入れ替わるたびに同じ費目の色が変わる(DESIGN.md 3章)。
   * 渡す順にも依存させない
   */
  it("渡された順や金額の大小では色が変わらない", () => {
    const ascending = buildExpenseSlices([expense("交通費", 1), expense("住居費", 999_999)]);
    const descending = buildExpenseSlices([expense("住居費", 999_999), expense("交通費", 1)]);

    expect(ascending.map((slice) => [slice.name, slice.color])).toEqual(
      descending.map((slice) => [slice.name, slice.color]),
    );
    expect(ascending[0]?.name).toBe("交通費");
  });

  /** 構成比の分母はその月の支出合計。負債のような符号違いのスライスが無いので純粋な割合になる */
  it("構成比はその月の支出合計に対する割合になる", () => {
    const slices = buildExpenseSlices([expense("住居費", 75_000), expense("食費", 25_000)]);

    expect(slices.map((slice) => [slice.name, slice.ratio])).toEqual([
      ["住居費", 0.75],
      ["食費", 0.25],
    ]);
  });

  it("費目が8件までなら全てに個別の色が付く", () => {
    const slices = buildExpenseSlices(
      ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => expense(name, 1_000)),
    );

    expect(slices).toHaveLength(8);
    expect(slices.at(-1)).toMatchObject({ name: "H", color: "var(--chart-8)" });
  });

  /**
   * 9色目は作らない(パレットは8色。DESIGN.md 3章)。溢れたときだけ個別色が先頭7件に減り、
   * 8番目のスロットが受け皿になる
   */
  it("9件以上なら先頭7件に個別色を付け、残りを1つにまとめる", () => {
    const slices = buildExpenseSlices(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((name) => expense(name, 1_000)),
    );

    expect(slices).toHaveLength(8);
    expect(slices.slice(0, 7).map((slice) => slice.name)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
    ]);
    expect(slices.at(-1)).toMatchObject({
      categoryId: "__other-expense__",
      name: "ほかの費目",
      // H と I の合計
      amount: 2_000,
      color: "var(--chart-8)",
    });
  });

  /**
   * マネーフォワードの大項目には「その他」が実在する。受け皿と同じ名前にすると、凡例に
   * 同じ名前が2行並んでどちらが何を指すのか読めなくなる(PO判断で受け皿を「ほかの費目」にした)。
   *
   * 名前順で先頭7件に入る「その他」は個別の色を持ち、受け皿と**同時に並ぶ**。この並びこそが
   * 衝突が実際に見える場面なので、そこを固定する
   */
  it("費目名の「その他」と受け皿が同時に並んでも取り違えない", () => {
    const slices = buildExpenseSlices(
      ["その他", "た", "ち", "つ", "て", "と", "な", "に", "ぬ"].map((name) =>
        expense(name, 1_000),
      ),
    );

    // 「その他」は名前順の先頭なので個別の色が付き、受け皿に吸収されない
    expect(slices[0]).toMatchObject({ categoryId: "その他", name: "その他" });
    expect(slices.at(-1)).toMatchObject({
      categoryId: "__other-expense__",
      name: "ほかの費目",
    });
    expect(slices.map((slice) => slice.name)).toEqual([
      "その他",
      "た",
      "ち",
      "つ",
      "て",
      "と",
      "な",
      "ほかの費目",
    ]);
  });

  /** 溢れが無ければ受け皿のスライスは足さない(凡例を埋めるだけになる) */
  it("溢れが無ければ受け皿を出さない", () => {
    const slices = buildExpenseSlices([expense("食費", 1_000)]);

    expect(slices.map((slice) => slice.categoryId)).toEqual(["食費"]);
  });

  it("費目が1件も無ければ空の配列を返す", () => {
    expect(buildExpenseSlices([])).toEqual([]);
  });
});
