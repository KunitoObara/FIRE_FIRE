import { describe, expect, it } from "vitest";

import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  buildCashflowSummary,
  collectAssetCategories,
  resolveAxisDebts,
  resolveAxisNetAmount,
  resolveAxisProperties,
  resolveDebtBalanceAt,
  resolvePropertyAmount,
  sumAxisAmount,
  sumDebtBalance,
  sumDebtBalanceAt,
  sumPropertyAmount,
  sumPropertyAmountAt,
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
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "投資信託"], 0, 0)).toBe(7_000_000);
  });

  /** 空配列は「すべての資産種別が対象」を意味する(B4) */
  it("集計対象が空配列なら全種別を合計する", () => {
    expect(sumAxisAmount(latestSnapshot, [], 0, 0)).toBe(11_400_000);
  });

  it("その日に存在しない資産種別が指定されていても無視する", () => {
    expect(sumAxisAmount(latestSnapshot, ["株式(現物)", "暗号資産"], 0, 0)).toBe(5_400_000);
  });

  it("対象が1件も残らなければ0を返す", () => {
    expect(sumAxisAmount(latestSnapshot, ["暗号資産"], 0, 0)).toBe(0);
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
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [], [], {}))).toEqual([
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ]);
  });

  it("集計対象の資産種別だけで各月の金額を出す", () => {
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, ["投資信託"], [], [], {}))).toEqual([
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
    expect(buildAxisNetWorthSeries(snapshots, ["投資信託"], [], [], {}).at(-1)?.byType).toEqual({
      投資信託: 1_600_000,
    });
  });

  it("集計対象が空配列なら全種別を内訳に持つ", () => {
    expect(buildAxisNetWorthSeries(snapshots, [], [], [], {}).at(-1)?.byType).toEqual({
      "預金・現金": 4_400_000,
      "株式(現物)": 5_400_000,
      投資信託: 1_600_000,
    });
  });

  it("入力の並び順によらず日付の昇順で返す", () => {
    expect(
      buildAxisNetWorthSeries([...snapshots].reverse(), [], [], [], {}).map((point) => point.date),
    ).toEqual(["2026-06-30", "2026-07-31", "2026-08-05"]);
  });

  it("資産残高が1件も無ければ空配列を返す", () => {
    expect(buildAxisNetWorthSeries([], [], [], [], {})).toEqual([]);
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
  // 発生年月は未入力。この場合の起点は最も古い記録(2026-07-31)になる
  originatedOn: null,
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
  originatedOn: null,
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

/**
 * 発生年月(B11-7)を入れた負債。残債の履歴はB11で保存したときにしか積まれないので、
 * これが無いと段差が「借りた月」ではなく「アプリに登録した月」に出る
 * (docs/screen-requirements-dashboard.md B1「発生年月からの反映」)。
 */
describe("resolveDebtBalanceAt(発生年月あり)", () => {
  /** 2026-04に借り、記録は7月末が最初。4〜7月は記録が無い */
  const withOrigin: Debt = { ...mortgage, originatedOn: "2026-04" };

  it("発生年月より前は差し引かない", () => {
    expect(resolveDebtBalanceAt(withOrigin, "2026-03-31")).toBe(0);
  });

  /**
   * その期間の実際の残債はアプリが知りえないので、知っている中でいちばん古い値を置く。
   * 実態より少なく出るが、起点が「登録した月」のままである読み違いのほうが大きい
   */
  it("発生年月から最初の記録までは、最も古い記録の残債を遡って当てる", () => {
    expect(resolveDebtBalanceAt(withOrigin, "2026-04-30")).toBe(4_000_000);
    expect(resolveDebtBalanceAt(withOrigin, "2026-06-30")).toBe(4_000_000);
  });

  /** 発生年月と同じ月の点も反映する(`yyyy-MM`と`yyyy-MM-dd`の桁を揃えて比べる) */
  it("発生年月と同じ月の点から差し引く", () => {
    expect(resolveDebtBalanceAt(withOrigin, "2026-04-01")).toBe(4_000_000);
  });

  it("記録がある期間は、これまでどおり当時の残債を採る", () => {
    expect(resolveDebtBalanceAt(withOrigin, "2026-07-31")).toBe(4_000_000);
    expect(resolveDebtBalanceAt(withOrigin, "2026-08-05")).toBe(3_000_000);
  });

  /** B11は入力時にこの前後関係をエラーにしないので、集計側が一意に決まる規則を持つ */
  it("発生年月が最初の記録より後でも、発生年月より前の点は差し引かない", () => {
    const originAfterRecord: Debt = { ...mortgage, originatedOn: "2026-08" };

    expect(resolveDebtBalanceAt(originAfterRecord, "2026-07-31")).toBe(0);
    expect(resolveDebtBalanceAt(originAfterRecord, "2026-08-05")).toBe(3_000_000);
  });

  /**
   * **発生年月より前の記録しか無い負債。** 既存の負債に発生年月だけを後から入力すると、
   * 残債が変わっていない保存では履歴が増えない(`buildNextBalanceHistory`)ため、この形になる。
   * 記録を選ぶ範囲まで発生年月で狭めると、起点以降に採れる記録が1件も無くなり、過去の全期間が
   * 残債0円になる(PR #143 のレビュー指摘)。
   */
  it("発生年月より前の記録しか無くても、その残債を起点以降に当てる", () => {
    const originOnly: Debt = {
      ...mortgage,
      originatedOn: "2026-08",
      balanceHistory: { "2024-01-15": 5_000_000 },
    };

    // 起点より前は差し引かない
    expect(resolveDebtBalanceAt(originOnly, "2026-07-31")).toBe(0);
    // 起点以降は、唯一の記録の残債を当てる(0にしない)
    expect(resolveDebtBalanceAt(originOnly, "2026-08-05")).toBe(5_000_000);
  });

  /** 履歴が1件も無ければ、発生年月を入れても遡って当てる値が無い */
  it("履歴が空なら発生年月があっても差し引かない", () => {
    expect(resolveDebtBalanceAt({ ...withOrigin, balanceHistory: {} }, "2026-08-05")).toBe(0);
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

describe("sumDebtBalance", () => {
  it("対象の負債の現在の残債を合計する", () => {
    expect(sumDebtBalance([mortgage, carLoan])).toBe(3_000_000 + 1_000_000);
  });

  /**
   * 「いま」を表す表示は履歴を見ない。ここが履歴に従うと、資産残高の最新日より後に
   * 保存された負債が全ての点で0として扱われる(B1-15の起票理由)
   */
  it("履歴が1件も無くても現在の残債を返す", () => {
    expect(sumDebtBalance([{ ...mortgage, balanceHistory: {} }])).toBe(3_000_000);
  });

  it("対象が1件も無ければ0を返す", () => {
    expect(sumDebtBalance([])).toBe(0);
  });

  /**
   * B11は完済した負債を残債0円のまま残せる(B11「入力項目の補足」)。履歴には返済中の
   * 記録が残っているが、「いま」差し引く額は0になる。
   */
  it("完済して残債0円になった負債は、履歴が残っていても差し引かない", () => {
    const repaid: Debt = {
      ...mortgage,
      balance: 0,
      balanceHistory: { "2026-07-31": 4_000_000, "2026-08-01": 0 },
    };

    expect(sumDebtBalance([repaid])).toBe(0);
  });
});

describe("sumAxisAmount(負債を含む分類軸, 0)", () => {
  it("対象の資産種別の合計から、渡された残債を差し引く", () => {
    expect(sumAxisAmount(latestSnapshot, [], sumDebtBalance([mortgage]), 0)).toBe(
      11_400_000 - 3_000_000,
    );
  });

  /** 負債が資産を上回る状態そのものなので0で止めない(丸めるのは表示側の達成率だけ) */
  it("負債が資産を上回れば負の値になる", () => {
    expect(sumAxisAmount(latestSnapshot, [], 20_000_000, 0)).toBe(11_400_000 - 20_000_000);
  });
});

describe("buildAxisNetWorthSeries(負債を含む分類軸)", () => {
  it("過去の点は、その時点以前の最も新しい残債を差し引く", () => {
    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [mortgage], [], {}))).toEqual([
      // 6月末は負債の登録前なので差し引かない
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 - 4_000_000 },
      // 最新点は履歴ではなく現在の残債(この負債は履歴の最後と同じ300万)
      { date: "2026-08-05", amount: 11_400_000 - 3_000_000 },
    ]);
  });

  /**
   * **この並びが B1-15 の不具合そのもの。** 残債の履歴に付く日付は保存した日だが、
   * 資産残高の最新日はCSVを最後に取り込んだ日なので、負債を登録した直後は
   * 「資産残高の最新日 < 負債の最初の履歴日」になる。履歴を最新点にも当てると
   * 全ての点で記録が見つからず、負債がグラフにも円グラフにもゲージにも出なくなる
   * (docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
   */
  it("資産残高の最新日より後に登録された負債も、最新点では差し引く", () => {
    const justRegistered: Debt = {
      ...mortgage,
      balance: 2_500_000,
      // 資産残高の最新日(2026-08-05)より後の日付しか履歴に無い
      balanceHistory: { "2026-08-10": 2_500_000 },
    };

    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [justRegistered], [], {}))).toEqual([
      // 過去は履歴に無いので差し引かない(遡って負債を作らない)
      { date: "2026-06-30", amount: 10_000_000 },
      { date: "2026-07-31", amount: 11_000_000 },
      // 最新点にだけ段差が出る。「そこから負債を管理し始めた」段差が右端に寄った状態
      { date: "2026-08-05", amount: 11_400_000 - 2_500_000 },
    ]);
  });

  /**
   * B11-7 の狙いそのもの。発生年月を入れると、段差が「アプリに登録した月」ではなく
   * 借りた月に移る(docs/screen-requirements-dashboard.md B1「発生年月からの反映」)。
   */
  it("発生年月を入れると、その月以降の点から差し引く", () => {
    // 2026-06に借りたことにする。記録は7月末が最初なので、6月末は遡って当てる
    const withOrigin: Debt = { ...mortgage, originatedOn: "2026-06" };

    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [withOrigin], [], {}))).toEqual([
      { date: "2026-06-30", amount: 10_000_000 - 4_000_000 },
      { date: "2026-07-31", amount: 11_000_000 - 4_000_000 },
      { date: "2026-08-05", amount: 11_400_000 - 3_000_000 },
    ]);
  });

  /** 残債を手で更新したあと、CSVを取り込み直す前でも最新点は最新の残債で描く */
  it("最新点は履歴の最後の記録ではなく現在の残債を引く", () => {
    const repaid: Debt = { ...mortgage, balance: 1_000_000 };

    expect(netAmountsOf(buildAxisNetWorthSeries(snapshots, [], [repaid], [], {})).at(-1)).toEqual({
      date: "2026-08-05",
      amount: 11_400_000 - 1_000_000,
    });
  });

  /**
   * 積み上げ表示は資産種別の帯だけを描き、負債は帯にしない(同要件B1)。
   * 差し引いた推移は純資産表示が描くので、内訳側で引くと二重に引くことになる。
   */
  it("負債を差し引くのは純額だけで、資産種別ごとの額からは引かない", () => {
    const latest = buildAxisNetWorthSeries(snapshots, [], [mortgage], [], {}).at(-1);

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
    netWorthSeries: buildAxisNetWorthSeries([snapshotWithNegative], [], [mortgage], [], {}),
    breakdown: buildAxisBreakdown(snapshotWithNegative, []),
    // 円グラフも推移グラフの最新点も「いま」なので、どちらも現在の残債を引く
    debtTotal: sumDebtBalance([mortgage]),
    propertyTotal: 0,
    hasSpreadProperty: false,
  };

  it("マイナス残高の資産種別があっても、推移グラフの最新点と一致する", () => {
    // 10,000,000 - 600,000 - 3,000,000(現在の残債) = 6,400,000
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

  /** 負債も不動産も含まない分類軸では併記そのものを出さない */
  it("負債も不動産も含まない分類軸はnullを返す", () => {
    expect(resolveAxisNetAmount({ ...axisDataWithNegative, debtTotal: 0 })).toBeNull();
  });

  /**
   * 不動産を含む軸でも分母が各スライスの絶対値の合計になるので、%が純資産に対する割合では
   * なくなる。負債が無くても併記する(B4-8)
   */
  it("負債が無くても不動産を含む分類軸なら併記する", () => {
    expect(
      resolveAxisNetAmount({ ...axisDataWithNegative, debtTotal: 0, propertyTotal: 5_000_000 }),
    ).toBe(axisDataWithNegative.netWorthSeries.at(-1)?.amount);
  });

  it("資産残高が未取込ならnullを返す", () => {
    expect(resolveAxisNetAmount(undefined)).toBeNull();
    expect(
      resolveAxisNetAmount({
        netWorthSeries: [],
        breakdown: [],
        debtTotal: 3_000_000,
        propertyTotal: 0,
        hasSpreadProperty: false,
      }),
    ).toBeNull();
  });
});

/** 収支サマリの検証用。対象月(2026-08)に含まれる取引を作る */
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
      "2026-08",
    );

    expect(summary).toMatchObject({ month: "2026-08", income: 420_000, expense: 98_000 });
  });

  /**
   * 支出を負のまま返すと、`CashflowSummaryCard`が収支を`income - expense`で出す作りのため
   * `income + |支出|`になり、赤字が黒字として出る(同書5章「集計した値の符号」)
   */
  it("支出は絶対値で持つ(0以上)", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", amount: -84_200 })],
      "2026-08",
    );

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
      "2026-08",
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
      "2026-08",
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
      "2026-08",
    );

    expect(summary?.expenseByCategory).toEqual([
      { name: "住居費", amount: 98_000 },
      { name: "食費", amount: 6_000 },
    ]);
  });

  it("収入は費目別支出に混ぜない", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", amount: 420_000, categoryMajor: "収入" })],
      "2026-08",
    );

    expect(summary?.expenseByCategory).toEqual([]);
  });

  /**
   * 対象の月は画面上で選べる(docs/screen-requirements-dashboard.md B1「年月の選択」)。
   * `now`から当月を導く実装が残っていると、過去の月を集計しても`month`が当月になり、
   * 読んだ範囲と表示している月が食い違う
   */
  it("対象月は渡された年月をそのまま持つ(当月に寄らない)", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", date: "2025-03-04", amount: -3_280 })],
      "2025-03",
    );

    expect(summary).toMatchObject({ month: "2025-03", expense: 3_280 });
  });

  /** 月初は正常にこの状態になるので、エラーとしては扱わない */
  it("取引が1件も無ければnullを返す(空状態のまま)", () => {
    expect(buildCashflowSummary([], "2026-08")).toBeNull();
  });

  /**
   * 空状態は「まだ取り込んでいない」と読める案内を出す。振替しかない月にそれを見せると、
   * 取り込んである取引を「無い」と伝えることになる
   */
  it("取引はあるが全て集計対象外なら、nullではなく0円で返す", () => {
    const summary = buildCashflowSummary(
      [buildTransaction({ id: "a", amount: -1_000_000, isTransfer: true })],
      "2026-08",
    );

    expect(summary).toMatchObject({ income: 0, expense: 0, expenseByCategory: [] });
  });
});

/**
 * 不動産を含む分類軸の集計(docs/screen-requirements-dashboard.md B1)。
 *
 * 規則は負債の残債と同じ — 過去の点は履歴、最新点は「いま」の値、起点(取得年月)より前は
 * 積まない。違うのは**符号**(加える)と、**反映方法が物件ごとに決まる**ことの2つ。
 */
describe("不動産を含む分類軸の集計", () => {
  const property = (overrides: Partial<RealEstateProperty> = {}): RealEstateProperty => ({
    id: "shibuya-101",
    name: "〇〇マンション101号室",
    location: "",
    acquiredOn: null,
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
    updatedAt: "2026-08-01",
    valueHistory: { "2026-08-01": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
    ...overrides,
  });

  describe("resolvePropertyAmount", () => {
    it("利ざやは時価からローン残高を引いた額になる", () => {
      expect(
        resolvePropertyAmount({ marketValue: 32_000_000, loanBalance: 18_400_000 }, "spread"),
      ).toBe(13_600_000);
    });

    it("時価で反映する物件はローン残高を引かない", () => {
      expect(
        resolvePropertyAmount({ marketValue: 32_000_000, loanBalance: 18_400_000 }, "marketValue"),
      ).toBe(32_000_000);
    });

    /** オーバーローンを0で止めると、資産を上回るローンがダッシュボードから消える(B1) */
    it("オーバーローンの物件は負のまま返す", () => {
      expect(
        resolvePropertyAmount({ marketValue: 12_800_000, loanBalance: 14_100_000 }, "spread"),
      ).toBe(-1_300_000);
    });
  });

  describe("resolveAxisProperties", () => {
    it("選ばれていない物件は落とす", () => {
      const selected = property();
      const other = property({ id: "yokohama-202" });

      expect(resolveAxisProperties([selected, other], { "shibuya-101": "spread" })).toEqual([
        selected,
      ]);
    });

    /** 削除された物件への参照はそのまま落ちる(削除済みの負債と同じ扱い。B4) */
    it("削除済みの物件への参照は何も足さない", () => {
      expect(resolveAxisProperties([], { "sold-out": "spread" })).toEqual([]);
    });
  });

  describe("sumPropertyAmountAt(過去の点)", () => {
    it("その時点以前で最も新しい記録を使う", () => {
      const withHistory = property({
        valueHistory: {
          "2026-06-01": { marketValue: 30_000_000, loanBalance: 19_000_000 },
          "2026-08-01": { marketValue: 32_000_000, loanBalance: 18_400_000 },
        },
      });

      expect(sumPropertyAmountAt([withHistory], { "shibuya-101": "spread" }, "2026-07-31")).toBe(
        11_000_000,
      );
    });

    /**
     * 時価とローン残高を別々に最新で探すと、実在しない日の組み合わせから利ざやを作ることに
     * なる(docs/screen-requirements-real-estate.md B7)。組で読むことをここで固定する
     */
    it("時価とローン残高は同じ日の記録から組で読む", () => {
      const withHistory = property({
        valueHistory: {
          "2026-06-01": { marketValue: 30_000_000, loanBalance: 19_000_000 },
          "2026-08-01": { marketValue: 32_000_000, loanBalance: 18_400_000 },
        },
      });

      // 6月の組(30,000,000 - 19,000,000)であって、時価だけ8月を混ぜた額ではない
      expect(sumPropertyAmountAt([withHistory], { "shibuya-101": "spread" }, "2026-06-15")).toBe(
        11_000_000,
      );
    });

    /** 起点(取得年月)より前の点には積まない。段差はそこから保有し始めた事実の表示 */
    it("取得年月より前の点には積まない", () => {
      const acquired = property({ acquiredOn: "2026-07" });

      expect(sumPropertyAmountAt([acquired], { "shibuya-101": "spread" }, "2026-06-30")).toBe(0);
      expect(sumPropertyAmountAt([acquired], { "shibuya-101": "spread" }, "2026-07-01")).toBe(
        13_600_000,
      );
    });

    /**
     * 取得年月から最初の記録までは、知っている中でいちばん古い記録を遡って当てる
     * (負債の「発生年月からの反映」と同じ)。当時の実際の額はアプリが知りえない
     */
    it("取得年月から最初の記録までは最も古い記録を当てる", () => {
      const acquired = property({
        acquiredOn: "2026-07",
        valueHistory: { "2026-08-01": { marketValue: 32_000_000, loanBalance: 18_400_000 } },
      });

      expect(sumPropertyAmountAt([acquired], { "shibuya-101": "spread" }, "2026-07-15")).toBe(
        13_600_000,
      );
    });

    /** 取得年月も履歴も無い物件は起点が決まらないので、過去の点には現れない */
    it("履歴も取得年月も無い物件は積まない", () => {
      const fresh = property({ valueHistory: {} });

      expect(sumPropertyAmountAt([fresh], { "shibuya-101": "spread" }, "2026-08-01")).toBe(0);
    });
  });

  /**
   * 「いま」は履歴ではなくB7で最後に保存した値を使う(負債と同じ理由)。履歴の日付は保存日、
   * 資産残高の最新日はCSVを最後に取り込んだ日で、後者が古いのが普通のため
   */
  describe("sumPropertyAmount(いま)", () => {
    it("履歴ではなく現在の時価・ローン残高を使う", () => {
      const updated = property({
        marketValue: 33_000_000,
        loanBalance: 18_000_000,
        // 履歴には古い値しか無い(保存のたびに積むので、最新の保存で足された分がここに来る前の状態)
        valueHistory: { "2026-06-01": { marketValue: 30_000_000, loanBalance: 19_000_000 } },
      });

      expect(sumPropertyAmount([updated], { "shibuya-101": "spread" })).toBe(15_000_000);
    });

    it("反映方法は物件ごとに効く", () => {
      const spread = property();
      const market = property({
        id: "yokohama-202",
        marketValue: 21_500_000,
        loanBalance: 15_200_000,
      });

      expect(
        sumPropertyAmount([spread, market], {
          "shibuya-101": "spread",
          "yokohama-202": "marketValue",
        }),
      ).toBe(13_600_000 + 21_500_000);
    });
  });

  describe("buildAxisNetWorthSeries(不動産を含む分類軸)", () => {
    it("純額に不動産を加え、帯の値も点ごとに持つ", () => {
      const acquired = property({
        acquiredOn: "2026-07",
        valueHistory: { "2026-07-01": { marketValue: 30_000_000, loanBalance: 20_000_000 } },
      });
      const series = buildAxisNetWorthSeries(snapshots, [], [], [acquired], {
        "shibuya-101": "spread",
      });

      // 最新点だけ「いま」の値(32,000,000 - 18,400,000)、それ以前は履歴(10,000,000)
      expect(series.at(-1)?.propertyAmount).toBe(13_600_000);
      expect(series.at(-1)?.amount).toBe(series.at(-1)?.amount ?? 0);
      expect(series.map((point) => point.propertyAmount)).toEqual([0, 10_000_000, 13_600_000]);
    });

    /** 不動産を1件も選んでいない分類軸の集計は、これまでと変わらない */
    it("物件を選んでいない分類軸では0のまま", () => {
      const series = buildAxisNetWorthSeries(snapshots, [], [], [], {});

      expect(series.every((point) => point.propertyAmount === 0)).toBe(true);
    });
  });
});
