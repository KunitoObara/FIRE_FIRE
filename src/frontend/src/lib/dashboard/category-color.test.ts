import { describe, expect, it } from "vitest";

import {
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  DEBT_CATEGORY_NAME,
  OTHER_CATEGORY_ID,
  PROPERTY_CATEGORY_ID,
} from "@/constants/dashboard";
import { buildBreakdownSlices, buildStackedTrend } from "@/lib/dashboard/category-color";

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

  /**
   * B9のリスクレベルを凡例に添えるための受け渡し
   * (docs/screen-requirements-dashboard.md B1「リスクの可視化」)。
   */
  describe("リスクレベル", () => {
    /** B9の想定値は資産種別名をキーに持つ。分類のIDが資産種別名そのものなのでそのまま引ける */
    const assumptions: AssetAssumptions = {
      fund: { expectedReturn: 5, riskLevel: "high" },
      deposit: { expectedReturn: null, riskLevel: "low" },
    };

    it("資産種別のスライスに、その資産種別のリスクレベルを付ける", () => {
      const slices = buildBreakdownSlices(
        [
          { categoryId: "fund", amount: 300 },
          { categoryId: "deposit", amount: 100 },
        ],
        categories,
        0,
        0,
        assumptions,
      );

      expect(slices.map((slice) => [slice.name, slice.riskLevel])).toEqual([
        ["投資信託", "high"],
        ["現金・預金", "low"],
      ]);
    });

    /** 「未設定」のバッジを並べると、まだ何も置いていない状態で凡例が最も混み合う(要件) */
    it("リスクレベルを設定していない資産種別はnullのままにする", () => {
      const slices = buildBreakdownSlices(
        [{ categoryId: "stock", amount: 100 }],
        categories,
        0,
        0,
        assumptions,
      );

      expect(slices[0]?.riskLevel).toBeNull();
    });

    /** B9の取得に失敗した場合もここに来る(1件も設定していない状態と同じ見た目になる) */
    it("想定値を渡さなければ、どのスライスにもリスクレベルは付かない", () => {
      const slices = buildBreakdownSlices([{ categoryId: "fund", amount: 100 }], categories);

      expect(slices[0]?.riskLevel).toBeNull();
    });

    /**
     * 「その他」は複数の資産種別をまとめたもので単一のリスクレベルに対応せず、
     * 「不動産」「負債」はB9に対応する行そのものが無い(要件)。
     */
    it("擬似分類(その他・不動産・負債)にはリスクレベルを付けない", () => {
      /** 色スロットを超える数の分類。9件目以降が「その他」へ落ちる */
      const manyCategories: AssetCategory[] = Array.from({ length: 9 }, (_, index) => ({
        id: `type-${index}`,
        name: `資産種別${index}`,
      }));
      const slices = buildBreakdownSlices(
        manyCategories.map((category) => ({ categoryId: category.id, amount: 100 })),
        manyCategories,
        2_000_000,
        3_000_000,
        // 「その他」へ落ちる資産種別にもリスクを置いておく(まとめた先へ漏れないことの確認)
        Object.fromEntries(
          manyCategories.map((category) => [
            category.id,
            { expectedReturn: null, riskLevel: "high" as const },
          ]),
        ),
      );

      const pseudoIds = [OTHER_CATEGORY_ID, PROPERTY_CATEGORY_ID, DEBT_CATEGORY_ID];

      expect(
        slices
          .filter((slice) => pseudoIds.includes(slice.categoryId))
          .map((slice) => [slice.categoryId, slice.riskLevel]),
      ).toEqual([
        [OTHER_CATEGORY_ID, null],
        [PROPERTY_CATEGORY_ID, null],
        [DEBT_CATEGORY_ID, null],
      ]);
    });
  });
});

/** 積み上げ表示の帯と各点(docs/screen-requirements-dashboard.md B1「積み上げ表示」) */
describe("buildStackedTrend", () => {
  const point = (date: string, byType: Record<string, number>, debtBalance = 0): NetWorthPoint => ({
    date,
    // 純額は積み上げ表示では使わない。負債を引いた別の値であることを示すため、あえてずらす
    amount: 0,
    byType,
    debtBalance,
    propertyAmount: 0,
  });

  /**
   * 同じ画面に並ぶ2つのグラフで同じ資産種別が違う色になると、内訳と推移を見比べられない。
   * 円グラフと同じスロット割り当てを共有していることを、色の並びで確かめる。
   */
  it("分類マスタの登録順に、円グラフと同じスロットの色を割り当てる", () => {
    const { bands } = buildStackedTrend(
      [point("2026-08-05", { stock: 100, fund: 300, deposit: 100 })],
      categories,
      false,
    );

    expect(bands.map((band) => [band.name, band.color])).toEqual([
      ["投資信託", "var(--chart-1)"],
      ["現金・預金", "var(--chart-2)"],
      ["株式", "var(--chart-3)"],
    ]);
  });

  /**
   * 色スロットの基準は直近1日の資産残高なので、すでに売却した資産種別はそこに現れない。
   * 過去の区間で「その他」へまとめる(許容と決めた挙動)。合計が欠けてはいけない。
   */
  it("直近1日に現れない資産種別(売却済み)を「その他」にまとめ、額を落とさない", () => {
    const { bands, points } = buildStackedTrend(
      [point("2025-08-31", { fund: 300, 暗号資産: 200 })],
      categories,
      false,
    );

    expect(bands.map((band) => band.categoryId)).toEqual(["fund", OTHER_CATEGORY_ID]);
    expect(points[0]?.amounts[OTHER_CATEGORY_ID]).toBe(200);
    expect(points[0]?.total).toBe(500);
  });

  /** 色スロットは8つしかないので、溢れた分は円グラフと同じく「その他」へ落ちる */
  it("スロットに収まらない資産種別も「その他」にまとめる", () => {
    const many: AssetCategory[] = Array.from({ length: 10 }, (_, index) => ({
      id: `type-${index}`,
      name: `資産${index}`,
    }));
    const { bands, points } = buildStackedTrend(
      [point("2026-08-05", Object.fromEntries(many.map((category) => [category.id, 100])))],
      many,
      false,
    );

    // 個別の色は7つまでで、8つ目のスロットが「その他」になる(円グラフと同じ規則)
    expect(bands).toHaveLength(8);
    expect(bands.at(-1)?.categoryId).toBe(OTHER_CATEGORY_ID);
    expect(points[0]?.amounts[OTHER_CATEGORY_ID]).toBe(300);
  });

  /**
   * マイナス残高の資産種別(借入・信用取引など)は0で止めず符号のまま積む。
   * 0に丸めると、その種別を保有していること自体が画面から消える。
   */
  it("マイナス残高の資産種別を符号のまま持ち、合計にも符号のまま加える", () => {
    const { points } = buildStackedTrend(
      [point("2026-08-05", { fund: 300, deposit: -100 })],
      categories,
      false,
    );

    expect(points[0]?.amounts.deposit).toBe(-100);
    expect(points[0]?.total).toBe(200);
  });

  /**
   * 色の割り当ての基準は符号を問わない(同節)。円グラフの「0円以下を除く」フィルタを
   * 掛けると、負の帯だけが常に「その他」になり凡例で識別できなくなる。
   */
  it("マイナス残高の資産種別にも固有の色を割り当てる", () => {
    const { bands } = buildStackedTrend(
      [point("2026-08-05", { fund: 300, deposit: -100 })],
      categories,
      false,
    );

    expect(bands.map((band) => band.categoryId)).toEqual(["fund", "deposit"]);
  });

  /** 全点で0の帯は面としては見えないまま凡例だけを埋める */
  it("期間内のどこでも0の資産種別は帯に出さない", () => {
    const { bands } = buildStackedTrend(
      [
        point("2026-07-31", { fund: 300, deposit: 0 }),
        point("2026-08-05", { fund: 400, deposit: 0 }),
      ],
      categories,
      false,
    );

    expect(bands.map((band) => band.categoryId)).toEqual(["fund"]);
  });

  /**
   * ツールチップの合計は行に並べた資産種別の総和で、**負債は含まない**(同節)。
   * 純額(`amount`)を使うと、積み上げが差し引いていないものを合計だけが差し引くことになる。
   */
  it("合計に純額(負債を引いた値)を使わない", () => {
    const withDebt: NetWorthPoint = {
      date: "2026-08-05",
      amount: 100,
      byType: { fund: 300, deposit: 200 },
      debtBalance: 400,
      propertyAmount: 0,
    };

    expect(buildStackedTrend([withDebt], categories, false).points[0]?.total).toBe(500);
  });

  it("点が1つも無ければ帯も点も空になる", () => {
    expect(buildStackedTrend([], categories, false)).toEqual({ bands: [], points: [] });
  });

  /**
   * 負債反映ONの帯(docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
   * 差し引くのではなく0より下の帯として積むので、面の上端(正の帯の合計)は動かない。
   */
  describe("負債の帯", () => {
    const withDebt = [point("2026-08-05", { fund: 300, deposit: 200 }, 400)];

    it("残債に-1を掛けた値を、擬似的な分類IDの帯として積む", () => {
      const { points } = buildStackedTrend(withDebt, categories, true);

      expect(points[0]?.amounts[DEBT_CATEGORY_ID]).toBe(-400);
    });

    /** 資産のスロットを奪うと、実際に保有している分類が「その他」へ押し出される */
    it("色スロットを消費せず、円グラフと同じ固定色を使う", () => {
      const { bands } = buildStackedTrend(withDebt, categories, true);

      expect(bands.map((band) => [band.categoryId, band.color])).toEqual([
        ["fund", "var(--chart-1)"],
        ["deposit", "var(--chart-2)"],
        [DEBT_CATEGORY_ID, DEBT_CATEGORY_COLOR],
      ]);
    });

    /** 合計は行に並べた額の総和。負債の行を含むので、その時点の純資産そのものになる */
    it("合計に負債の行を含める", () => {
      expect(buildStackedTrend(withDebt, categories, true).points[0]?.total).toBe(100);
    });

    it("資産のみのときは帯も合計への算入もしない", () => {
      const { bands, points } = buildStackedTrend(withDebt, categories, false);

      expect(bands.some((band) => band.categoryId === DEBT_CATEGORY_ID)).toBe(false);
      expect(points[0]?.amounts[DEBT_CATEGORY_ID]).toBeUndefined();
      expect(points[0]?.total).toBe(500);
    });

    /** 全点で0の帯は、面としては見えないまま凡例だけを埋める(資産種別と同じ扱い) */
    it("残債が0の期間だけなら帯を出さない", () => {
      const { bands } = buildStackedTrend(
        [point("2026-08-05", { fund: 300 }, 0)],
        categories,
        true,
      );

      expect(bands.some((band) => band.categoryId === DEBT_CATEGORY_ID)).toBe(false);
    });
  });
});

/**
 * 不動産の帯・スライス(docs/screen-requirements-dashboard.md B1「グラフでの見せ方」)。
 *
 * 擬似的な分類IDで表し、表示名「不動産」との一致では判定しない — CSVの資産種別に
 * 「不動産」が現れうるため。並びは資産種別の後ろ・負債の前で固定する。
 */
describe("不動産の帯・スライス", () => {
  const categories: AssetCategory[] = [
    { id: "現金・預金", name: "現金・預金" },
    { id: "投資信託", name: "投資信託" },
  ];

  it("帯は資産種別の後ろ・負債の前に並ぶ", () => {
    const { bands } = buildStackedTrend(
      [
        {
          date: "2026-08-01",
          amount: 0,
          byType: { "現金・預金": 5_000_000 },
          debtBalance: 3_000_000,
          propertyAmount: 13_600_000,
        },
      ],
      categories,
      true,
    );

    expect(bands.map((band) => band.categoryId)).toEqual([
      "現金・預金",
      PROPERTY_CATEGORY_ID,
      DEBT_CATEGORY_ID,
    ]);
  });

  /**
   * 切替が動かすのはB11の負債だけ(同要件「負債反映の切替との関係」)。「資産のみ」でも
   * 不動産は分類軸の設定どおりに積まれ続ける
   */
  it("「資産のみ」でも不動産の帯は残る", () => {
    const { bands, points } = buildStackedTrend(
      [
        {
          date: "2026-08-01",
          amount: 0,
          byType: { "現金・預金": 5_000_000 },
          debtBalance: 3_000_000,
          propertyAmount: 13_600_000,
        },
      ],
      categories,
      false,
    );

    expect(bands.map((band) => band.categoryId)).toEqual(["現金・預金", PROPERTY_CATEGORY_ID]);
    expect(points[0]?.amounts[PROPERTY_CATEGORY_ID]).toBe(13_600_000);
  });

  /** オーバーローンの物件は負のまま積む(`stackOffset="sign"`で0より下に来る) */
  it("利ざやが負なら負の値のまま帯に載る", () => {
    const { points } = buildStackedTrend(
      [
        {
          date: "2026-08-01",
          amount: 0,
          byType: {},
          debtBalance: 0,
          propertyAmount: -1_300_000,
        },
      ],
      categories,
      true,
    );

    expect(points[0]?.amounts[PROPERTY_CATEGORY_ID]).toBe(-1_300_000);
  });

  it("スライスは資産種別の後ろ・負債の前で、色スロットを消費しない", () => {
    const slices = buildBreakdownSlices(
      [{ categoryId: "現金・預金", amount: 5_000_000 }],
      categories,
      3_000_000,
      13_600_000,
    );

    expect(slices.map((slice) => slice.categoryId)).toEqual([
      "現金・預金",
      PROPERTY_CATEGORY_ID,
      DEBT_CATEGORY_ID,
    ]);
    // 資産種別は先頭のスロットのまま(不動産に奪われない)
    expect(slices[0]?.color).toBe("var(--chart-1)");
  });

  /**
   * 分母は各スライスの絶対値の合計。オーバーローンでもスライスを落とさず、面積は絶対値、
   * 額は符号付きで持つ(凡例が符号付きで出せるように)
   */
  it("合計が負でもスライスを出し、額は符号付き・比は絶対値で持つ", () => {
    const slices = buildBreakdownSlices(
      [{ categoryId: "現金・預金", amount: 5_000_000 }],
      categories,
      0,
      -5_000_000,
    );
    const property = slices.find((slice) => slice.categoryId === PROPERTY_CATEGORY_ID);

    expect(property?.amount).toBe(-5_000_000);
    // 分母 = 5,000,000 + |-5,000,000| = 10,000,000
    expect(property?.ratio).toBe(0.5);
  });

  /** 出さないのはちょうど0円のときだけ(0円のスライスは凡例を埋めるだけ) */
  it("合計がちょうど0円ならスライスを出さない", () => {
    const slices = buildBreakdownSlices(
      [{ categoryId: "現金・預金", amount: 5_000_000 }],
      categories,
      0,
      0,
    );

    expect(slices.some((slice) => slice.categoryId === PROPERTY_CATEGORY_ID)).toBe(false);
  });
});
