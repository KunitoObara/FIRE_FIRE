import { describe, expect, it } from "vitest";

import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  buildCashflowSummary,
  collectAssetCategories,
  resolveAxisDebts,
  resolveAxisNetAmount,
  resolveDebtBalanceAt,
  sumAxisAmount,
  sumDebtBalanceAt,
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
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "投資信託"], [])).toBe(7_000_000);
  });

  /** 空配列は「すべての資産種別が対象」を意味する(B4) */
  it("集計対象が空配列なら全種別を合計する", () => {
    expect(sumAxisAmount(latestSnapshot, [], [])).toBe(11_400_000);
  });

  it("その日に存在しない資産種別が指定されていても無視する", () => {
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "暗号資産"], [])).toBe(5_400_000);
  });

  it("対象が1件も残らなければ0を返す", () => {
    expect(sumAxisAmount(latestSnapshot, ["暗号資産"], [])).toBe(0);
  });
});

/**
 * 純額(純資産表示が描く値)だけを取り出す。内訳(`byType`)は積み上げ表示のもので、
 * 別のテストで確かめる。
 */
const netAmountsOf = (series: NetWorthPoint[]): { date: string; amount: number }[] =>
  series.map((point) => ({ date: point.date, amount: point.amount }));

describe("buildAxisNetWorthSeries", () => {
  /** 当月の日次が並ぶと、月次の目盛り・ツールチップと1対1で対応しなくなる */
  it("月ごとに、その月でいちばん新しい集計日の残高を1点にする", () => {
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], []))).toEqual([
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ]);
  });

  it("集計対象の資産種別だけで各月の金額を出す", () => {
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, ["投資信託"], []))).toEqual([
      { date: "2026-06-30", amount: 1_000_000 },
      { date: "2026-07-31", amount: 1_500_000 },
      { date: "2026-08-05", amount: 1_600_000 },
    ]);
  });

  /**
   * 積み上げ表示が描く値。純額(`amount`)とは別に持ち、**負債を引かない**
   * (docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
   */
  it("各点に集計対象の資産種別ごとの額を持たせる", () => {
    expect(buildAxisNetWorthSeries(snapshots, ["投資信託"], []).at(-1)?.byType).toEqual({
      投資信託: 1_600_000,
    });
  });

  it("集計対象が空配列なら全種別を内訳に持つ", () => {
    expect(buildAxisNetWorthSeries(snapshots, [], []).at(-1)?.byType).toEqual({
      "預金・現金": 4_400_000,
      "株式(現物)": 5_400_000,
      投資信託: 1_600_000,
    });
  });

  it("入力の並び順によらず日付の昇順で返す", () => {
    expect(
      buildAxisNetWorthSeries([...snapshots].reverse(), [], []).map((point) => point.date),
    ).toEqual(["2026-06-30", "2026-07-31", "2026-08-05"]);
  });

  it("資産残高が1件も無ければ空配列を返す", () => {
    expect(buildAxisNetWorthSeries([], [], [])).toEqual([]);
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

/**
 * 負債(B11)を含む分類軸の集計。
 * 「対象の資産種別の合計 - 対象の負債の残債」になる(docs/screen-requirements-dashboard.md B1)。
 */
const mortgage: Debt = {
  id: "debt-mortgage",
  name: "住宅ローン",
  balance: 3_000_000,
  interestRate: 0.475,
  repaymentMonths: 280,
  updatedAt: "2026-08-01",
  // 7月末に400万、8月に300万へ減った履歴。6月末より前には記録が無い
  balanceHistory: { "2026-07-31": 4_000_000, "2026-08-01": 3_000_000 },
};

const carLoan: Debt = {
  id: "debt-car",
  name: "自動車ローン",
  balance: 1_000_000,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-08-01",
  balanceHistory: { "2026-08-01": 1_000_000 },
};

describe("resolveAxisDebts", () => {
  it("分類軸が選んだ負債だけを返す", () => {
    expect(resolveAxisDebts([mortgage, carLoan], ["debt-car"])).toEqual([carLoan]);
  });

  /** `assetTypeNames`と違い「未選択=すべて」の読み替えをしない(B4) */
  it("1件も選んでいない分類軸は負債を差し引かない", () => {
    expect(resolveAxisDebts([mortgage, carLoan], [])).toEqual([]);
  });

  /** 存在しない資産種別が`byType`に無いときと同じ扱い(B1) */
  it("B11で削除された負債への参照は落とす", () => {
    expect(resolveAxisDebts([mortgage], ["debt-mortgage", "debt-deleted"])).toEqual([mortgage]);
  });
});

describe("resolveDebtBalanceAt", () => {
  it("その時点以前で最も新しい記録を採る", () => {
    expect(resolveDebtBalanceAt(mortgage, "2026-07-31")).toBe(4_000_000);
  });

  it("記録の無い日は直前の記録を引き継ぐ", () => {
    expect(resolveDebtBalanceAt(mortgage, "2026-08-05")).toBe(3_000_000);
  });

  /** 残債が分からない期間に現在の値を当てると、実際には無かった負債を過去に作ることになる */
  it("最初の記録より前の時点では差し引かない", () => {
    expect(resolveDebtBalanceAt(mortgage, "2026-06-30")).toBe(0);
  });

  it("履歴が空なら差し引かない", () => {
    expect(resolveDebtBalanceAt({ ...mortgage, balanceHistory: {} }, "2026-08-05")).toBe(0);
  });
});

describe("sumDebtBalanceAt", () => {
  it("対象の負債の残債をその時点の値で合計する", () => {
    expect(sumDebtBalanceAt([mortgage, carLoan], "2026-08-05")).toBe(4_000_000);
  });

  it("登録前の負債は合計に入らない", () => {
    expect(sumDebtBalanceAt([mortgage, carLoan], "2026-07-31")).toBe(4_000_000);
  });
});

describe("sumAxisAmount(負債を含む分類軸)", () => {
  it("対象の資産種別の合計から、その時点の残債を差し引く", () => {
    expect(sumAxisAmount(latestSnapshot, [], [mortgage])).toBe(11_400_000 - 3_000_000);
  });

  /** 負債が資産を上回る状態そのものなので0で止めない(丸めるのは表示側の達成率だけ) */
  it("負債が資産を上回れば負の値になる", () => {
    const hugeDebt: Debt = { ...mortgage, balanceHistory: { "2026-08-01": 20_000_000 } };

    expect(sumAxisAmount(latestSnapshot, [], [hugeDebt])).toBe(11_400_000 - 20_000_000);
  });
});

describe("buildAxisNetWorthSeries(負債を含む分類軸)", () => {
  it("各時点で、その時点以前の最も新しい残債を差し引く", () => {
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [mortgage]))).toEqual([
      // 6月末は負債の登録前なので差し引かない
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 - 4_000_000 },
      { date: "2026-08-05", amount: 11_400_000 - 3_000_000 },
    ]);
  });

  /**
   * 積み上げ表示は資産種別の帯だけを描き、負債は帯にしない(同要件B1)。
   * 差し引いた推移は純資産表示が描くので、内訳側で引くと二重に引くことになる。
   */
  it("負債を差し引くのは純額だけで、資産種別ごとの額からは引かない", () => {
    const latest = buildAxisNetWorthSeries(snapshots, [], [mortgage]).at(-1);

    expect(latest?.amount).toBe(11_400_000 - 3_000_000);
    expect(latest?.byType).toEqual({
      "預金・現金": 4_400_000,
      "株式(現物)": 5_400_000,
      投資信託: 1_600_000,
    });
  });
});

describe("resolveAxisNetAmount", () => {
  /**
   * マネーフォワードのCSVには借入・信用取引のようにマイナス残高で現れる資産種別がある。
   * 円グラフのスライスは「0円以下の資産種別を除く」ので、それを足し直して純額を出すと
   * 推移グラフの最新点・FIRE達成度ゲージの現在資産額とずれる(PR #83 のレビュー指摘)。
   */
  const snapshotWithNegative: AssetSnapshot = {
    date: "2026-08-05",
    total: 9_400_000,
    byType: { "預金・現金": 10_000_000, 信用取引: -600_000 },
  };

  const axisDataWithNegative: AssetAxisData = {
    netWorthSeries: buildAxisNetWorthSeries([snapshotWithNegative], [], [mortgage]),
    breakdown: buildAxisBreakdown(snapshotWithNegative, []),
    debtTotal: sumDebtBalanceAt([mortgage], snapshotWithNegative.date),
  };

  it("マイナス残高の資産種別があっても、推移グラフの最新点と一致する", () => {
    // 10,000,000 - 600,000 - 3,000,000(2026-08-01時点の残債) = 6,400,000
    expect(resolveAxisNetAmount(axisDataWithNegative)).toBe(6_400_000);
    expect(resolveAxisNetAmount(axisDataWithNegative)).toBe(
      axisDataWithNegative.netWorthSeries.at(-1)?.amount,
    );
  });

  /** スライスを足し直す実装だと、除外されたマイナス分だけ純額が過大になっていた */
  it("スライスの足し直しでは一致しないことを示す(退行の目印)", () => {
    const fromSlices =
      axisDataWithNegative.breakdown.reduce((sum, entry) => sum + entry.amount, 0) -
      axisDataWithNegative.debtTotal;

    expect(fromSlices).toBe(7_000_000);
    expect(fromSlices).not.toBe(resolveAxisNetAmount(axisDataWithNegative));
  });

  /** 負債を含まない分類軸では併記そのものを出さない */
  it("負債を差し引かない分類軸はnullを返す", () => {
    expect(resolveAxisNetAmount({ ...axisDataWithNegative, debtTotal: 0 })).toBeNull();
  });

  it("資産残高が未取込ならnullを返す", () => {
    expect(resolveAxisNetAmount(undefined)).toBeNull();
    expect(
      resolveAxisNetAmount({ netWorthSeries: [], breakdown: [], debtTotal: 3_000_000 }),
    ).toBeNull();
  });
});

/** 収支サマリの検証用。当月(2026-08)の取引を作る */
const NOW = new Date("2026-08-05T12:00:00+09:00");

const buildTransaction = (transaction: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-08-05",
  content: "スーパー〇〇",
  amount: -3_280,
  account: "〇〇カード",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...transaction,
});

describe("buildCashflowSummary", () => {
  it("収入と支出を分けて集計し、対象月を`yyyy-MM`で返す", () => {
    const summary = buildCashflowSummary(
      [
        buildTransaction({ id: "a", amount: 420_000, categoryMajor: "収入" }),
        buildTransaction({ id: "b", amount: -98_000, categoryMajor: "住居費" }),
      ],
      NOW,
    );

    expect(summary).toMatchObject({ month: "2026-08", income: 420_000, expense: 98_000 });
  });

  /**
   * 支出を負のまま返すと、`CashflowSummaryCard`が収支を`income - expense`で出す作りのため
   * `income + |支出|`になり、赤字が黒字として出る(同書5章「集計した値の符号」)
   */
  it("支出は絶対値で持つ(0以上)", () => {
    const summary = buildCashflowSummary([buildTransaction({ id: "a", amount: -84_200 })], NOW);

    expect(summary?.expense).toBe(84_200);
    expect(summary?.expenseByCategory[0]?.amount).toBe(84_200);
  });

  /** 自口座間の移動を数えると、収支が0のまま収入と支出だけが膨らむ(同書5章) */
  it("振替は収入にも支出にも数えない", () => {
    const summary = buildCashflowSummary(
      [
        buildTransaction({ id: "a", amount: 1_000_000, isTransfer: true, categoryMajor: "振替" }),
        buildTransaction({ id: "b", amount: -1_000_000, isTransfer: true, categoryMajor: "振替" }),
        buildTransaction({ id: "c", amount: -3_280 }),
      ],
      NOW,
    );

    expect(summary).toMatchObject({ income: 0, expense: 3_280 });
    expect(summary?.expenseByCategory).toEqual([{ name: "食費", amount: 3_280 }]);
  });

  /** マネーフォワード側でユーザーが下した判断を、アプリ側で読み替えない(同書5章) */
  it("計算対象外の取引も数えない", () => {
    const summary = buildCashflowSummary(
      [
        buildTransaction({ id: "a", amount: -50_000, isCalculationTarget: false }),
        buildTransaction({ id: "b", amount: -3_280 }),
      ],
      NOW,
    );

    expect(summary?.expense).toBe(3_280);
  });

  /** 中項目まで割るとカードに収まらない(同書6章) */
  it("費目別支出は大項目でまとめ、金額の多い順に並べる", () => {
    const summary = buildCashflowSummary(
      [
        buildTransaction({
          id: "a",
          amount: -3_280,
          categoryMajor: "食費",
          categoryMinor: "食料品",
        }),
        buildTransaction({ id: "b", amount: -2_720, categoryMajor: "食費", categoryMinor: "外食" }),
        buildTransaction({ id: "c", amount: -98_000, categoryMajor: "住居費" }),
      ],
      NOW,
    );

    expect(summary?.expenseByCategory).toEqual([
      { name: "住居費", amount: 98_000 },
      { name: "食費", amount: 6_000 },
    ]);
  });

  it("収入は費目別支出に混ぜない", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", amount: 420_000, categoryMajor: "収入" })],
      NOW,
    );

    expect(summary?.expenseByCategory).toEqual([]);
  });

  /** 月初は正常にこの状態になるので、エラーとしては扱わない */
  it("取引が1件も無ければnullを返す(空状態のまま)", () => {
    expect(buildCashflowSummary([], NOW)).toBeNull();
  });

  /**
   * 空状態は「まだ取り込んでいない」と読める案内を出す。振替しかない月にそれを見せると、
   * 取り込んである取引を「無い」と伝えることになる
   */
  it("取引はあるが全て集計対象外なら、nullではなく0円で返す", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", amount: -1_000_000, isTransfer: true })],
      NOW,
    );

    expect(summary).toMatchObject({ income: 0, expense: 0, expenseByCategory: [] });
  });
});
