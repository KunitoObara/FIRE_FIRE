import { describe, expect, it } from "vitest";

import { buildExpenseSlices } from "@/lib/dashboard/expense-color";

const expense = (name: string, amount: number): ExpenseByCategory => ({ name, amount });

/** 生成色の色相を読み出す(`oklch(L C H)`の3つ目) */
const hueOf = (color: string): number => Number(color.replace(/^oklch\(\S+ \S+ (\S+)\)$/, "$1"));

/**
 * 費目別支出の色と構成比(docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。
 *
 * 費目マスタは持たない(docs/transaction-import-requirements.md 6章)ので、資産分類のような
 * 「登録順」が無い。並びは**金額の多い順**で決め、その月に現れた大項目は全て個別のスライスになる
 * ([B1-18](https://trello.com/c/UTWWqbpy))。
 */
describe("buildExpenseSlices", () => {
  it("金額の多い順に、末尾のスロットから降順で色を割り当てる", () => {
    const slices = buildExpenseSlices([
      expense("食費", 62_400),
      expense("交通費", 21_000),
      expense("住居費", 97_000),
    ]);

    expect(slices.map((slice) => [slice.name, slice.color])).toEqual([
      ["住居費", "var(--chart-8)"],
      ["食費", "var(--chart-7)"],
      ["交通費", "var(--chart-6)"],
    ]);
  });

  /**
   * 資産分類カラー(`category-color.ts`)は`--chart-1`から昇順に配る。両方を先頭から埋めると
   * 同じ画面に並ぶ2つの円グラフで無関係な資産種別と費目が同じ色になるため、費目は末尾から
   * 配る([B11-9-2](https://trello.com/c/zh3egdfo))。
   *
   * ここで固定するのは**このモジュールの側の約束**(末尾から詰めて配ること)だけにする。
   * 資産側のスロットをリテラルで書き写すと、あちらの配り方が変わってもこのテストは通ったままになる。
   */
  it("費目が4件なら末尾4つのスロットに収まり、先頭側を空けたままにする", () => {
    const slices = buildExpenseSlices(
      ["A", "B", "C", "D"].map((name, index) => expense(name, 4_000 - index)),
    );

    expect(slices.map((slice) => slice.color)).toEqual([
      "var(--chart-8)",
      "var(--chart-7)",
      "var(--chart-6)",
      "var(--chart-5)",
    ]);
  });

  /**
   * 金額が同じ費目が並ぶ月に、`sort`の安定性と渡された順へ結果が依存すると、同じデータでも
   * 表示が変わりうる。費目名をタイブレークに使って固定する
   */
  it("金額が同じ費目は費目名の順に並べる", () => {
    const slices = buildExpenseSlices([
      expense("交通費", 10_000),
      expense("医療費", 10_000),
      expense("食費", 10_000),
    ]);

    expect(slices.map((slice) => slice.name)).toEqual(["医療費", "交通費", "食費"]);
  });

  it("渡された順では並びも色も変わらない", () => {
    const ascending = buildExpenseSlices([expense("交通費", 1), expense("住居費", 999_999)]);
    const descending = buildExpenseSlices([expense("住居費", 999_999), expense("交通費", 1)]);

    expect(ascending.map((slice) => [slice.name, slice.color])).toEqual(
      descending.map((slice) => [slice.name, slice.color]),
    );
    expect(ascending[0]?.name).toBe("住居費");
  });

  /** 構成比の分母はその月の支出合計。負債のような符号違いのスライスが無いので純粋な割合になる */
  it("構成比はその月の支出合計に対する割合になる", () => {
    const slices = buildExpenseSlices([expense("住居費", 75_000), expense("食費", 25_000)]);

    expect(slices.map((slice) => [slice.name, slice.ratio])).toEqual([
      ["住居費", 0.75],
      ["食費", 0.25],
    ]);
  });

  it("費目が8件までなら既存の8スロットに収まる", () => {
    const slices = buildExpenseSlices(
      ["A", "B", "C", "D", "E", "F", "G", "H"].map((name, index) => expense(name, 8_000 - index)),
    );

    expect(slices).toHaveLength(8);
    // 金額最大が --chart-8 なので、8件目は --chart-1 になる
    expect(slices[0]).toMatchObject({ name: "A", color: "var(--chart-8)" });
    expect(slices.at(-1)).toMatchObject({ name: "H", color: "var(--chart-1)" });
  });

  /**
   * 8スロットに収まらない月は色を作る。**受け皿にまとめない** — マネーフォワードの大項目は
   * 15前後あるため、まとめると税・社会保障費や日用品といった費目が毎月消える(このカードの起点)
   */
  it("費目が9件以上でも全てが個別のスライスになる", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const slices = buildExpenseSlices(names.map((name, index) => expense(name, 9_000 - index)));

    expect(slices.map((slice) => slice.name)).toEqual(names);
    expect(slices.map((slice) => slice.amount).reduce((sum, amount) => sum + amount)).toBe(
      names.reduce((sum, unused, index) => sum + (9_000 - index), 0),
    );
  });

  it("生成した色は費目ごとに異なり、色相が等間隔になる", () => {
    const slices = buildExpenseSlices(
      Array.from({ length: 12 }, (unused, index) => expense(`費目${index}`, 12_000 - index)),
    );
    const colors = slices.map((slice) => slice.color);

    expect(new Set(colors).size).toBe(12);
    expect(colors.every((color) => color.startsWith("oklch("))).toBe(true);
    // 360 / 12 = 30度ずつ。最後は1周して先頭へ戻る
    expect(colors.map((color) => hueOf(color))).toEqual([
      24.9, 54.9, 84.9, 114.9, 144.9, 174.9, 204.9, 234.9, 264.9, 294.9, 324.9, 354.9,
    ]);
  });

  /**
   * 8件以下で金額最大の費目に当たるのは`--chart-8`(#e34948、H=24.9)。9件目が現れて生成へ
   * 切り替わっても、いちばん大きい費目の色味だけは動かないように起点を合わせてある
   */
  it("生成へ切り替わっても金額最大の費目の色相は--chart-8に揃える", () => {
    const slices = buildExpenseSlices(
      Array.from({ length: 9 }, (unused, index) => expense(`費目${index}`, 9_000 - index)),
    );

    expect(hueOf(slices[0]?.color ?? "")).toBe(24.9);
  });

  it("費目が1件でも色が付く", () => {
    const slices = buildExpenseSlices([expense("食費", 1_000)]);

    expect(slices).toEqual([
      { categoryId: "食費", name: "食費", amount: 1_000, ratio: 1, color: "var(--chart-8)" },
    ]);
  });

  it("費目が1件も無ければ空の配列を返す", () => {
    expect(buildExpenseSlices([])).toEqual([]);
  });

  /** 支出が全て0円の月でも0除算せずに返す(振替しかない月の集計がここへ来ることがある) */
  it("支出合計が0円なら構成比を0にする", () => {
    const slices = buildExpenseSlices([expense("食費", 0), expense("交通費", 0)]);

    expect(slices.map((slice) => slice.ratio)).toEqual([0, 0]);
  });
});
