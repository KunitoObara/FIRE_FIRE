import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDashboardData } from "@/lib/dashboard/dashboard-data";

const fetchCategoryAxes = vi.fn();
const fetchAssetSnapshots = vi.fn();
const fetchLastImportedAt = vi.fn();
const fetchFireGoal = vi.fn();
const fetchDebts = vi.fn();
const fetchMonthlyTransactions = vi.fn();

vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: () => fetchCategoryAxes(),
}));

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchAssetSnapshots: () => fetchAssetSnapshots(),
  fetchLastImportedAt: () => fetchLastImportedAt(),
}));

vi.mock("@/lib/fire-goal/fire-goal-repository", () => ({
  fetchFireGoal: () => fetchFireGoal(),
}));

vi.mock("@/lib/debts/debt-repository", () => ({
  fetchDebts: () => fetchDebts(),
}));

vi.mock("@/lib/csv-import/transaction-repository", () => ({
  fetchMonthlyTransactions: (...args: unknown[]) => fetchMonthlyTransactions(...args),
}));

/** 当月の取引(B2で取り込んだもの)。既定は0件にして、収支サマリを扱わない既存のケースの期待値を変えない */
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

const axes: AssetCategoryAxisDocument[] = [
  {
    id: "total",
    name: "総資産",
    assetTypeNames: [],
    debtIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "investment",
    name: "投資性資産",
    assetTypeNames: ["株式(現物)", "投資信託"],
    debtIds: [],
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

const snapshots: AssetSnapshot[] = [
  {
    date: "2026-07-31",
    total: 11_000_000,
    byType: { "預金・現金": 4_200_000, "株式(現物)": 5_300_000, 投資信託: 1_500_000 },
  },
  {
    date: "2026-08-05",
    total: 11_400_000,
    byType: { "預金・現金": 4_400_000, "株式(現物)": 5_400_000, 投資信託: 1_600_000 },
  },
];

describe("fetchDashboardData", () => {
  beforeEach(() => {
    fetchCategoryAxes.mockReset();
    fetchAssetSnapshots.mockReset();
    fetchLastImportedAt.mockReset();
    fetchFireGoal.mockReset();
    // 負債(B11)。既定は取得成功・0件にして、負債を扱わない既存のケースの期待値を変えない
    fetchDebts.mockReset();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    fetchMonthlyTransactions.mockReset();
    fetchMonthlyTransactions.mockResolvedValue({ ok: true, transactions: [], truncated: false });

    fetchCategoryAxes.mockResolvedValue({ ok: true, axes });
    fetchAssetSnapshots.mockResolvedValue({ ok: true, snapshots });
    fetchLastImportedAt.mockResolvedValue({
      ok: true,
      lastImportedAt: "2026-08-05T12:00:00.000Z",
    });
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
        achievementAxisId: null,
      },
    });
  });

  it("B4で登録した分類軸をそのままセレクタの選択肢にする", async () => {
    const result = await fetchDashboardData();

    expect(result).toMatchObject({
      ok: true,
      data: {
        axes: [
          { id: "total", name: "総資産" },
          { id: "investment", name: "投資性資産" },
        ],
      },
    });
  });

  it("分類軸ごとに、集計対象の資産種別だけで推移と内訳を組み立てる", async () => {
    const result = await fetchDashboardData();

    if (!result.ok) {
      throw new Error("取得に失敗した");
    }

    // 純額(純資産表示が描く値)。資産種別ごとの内訳は`buildAxisNetWorthSeries`側で確かめる
    expect(
      result.data.byAxis.total?.netWorthSeries.map((point) => [point.date, point.amount]),
    ).toEqual([
      ["2026-07-31", 11_000_000],
      ["2026-08-05", 11_400_000],
    ]);
    expect(
      result.data.byAxis.investment?.netWorthSeries.map((point) => [point.date, point.amount]),
    ).toEqual([
      ["2026-07-31", 6_800_000],
      ["2026-08-05", 7_000_000],
    ]);
    expect(result.data.byAxis.investment?.breakdown).toEqual([
      { categoryId: "株式(現物)", amount: 5_400_000 },
      { categoryId: "投資信託", amount: 1_600_000 },
    ]);
  });

  it("直近CSV取込日時とFIRE達成度を実データから埋める", async () => {
    const result = await fetchDashboardData();

    expect(result).toMatchObject({
      ok: true,
      data: {
        lastImportedAt: "2026-08-05T12:00:00.000Z",
        fireProgress: {
          targetAmount: 80_000_000,
          // 対象分類が未設定なので、現在資産額はCSVの合計(直近の資産残高の`total`)
          currentAmount: 11_400_000,
          achievementAxisName: "総資産(マネーフォワードの合計)",
          achievementAxisMissing: false,
          projectedAchievementDate: null,
        },
      },
    });
  });

  /**
   * B8で対象分類に選んだ分類軸で集計する(要件B1)。同じ分類軸をB1のセレクタで選んだときの
   * 資産推移グラフの最新点(`byAxis.investment`の末尾)と一致することまで確かめる。
   */
  it("対象分類に分類軸が設定されていれば、その分類軸の集計を現在資産額にする", async () => {
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
        achievementAxisId: "investment",
      },
    });

    const result = await fetchDashboardData();

    if (!result.ok) {
      throw new Error("取得に失敗した");
    }

    expect(result.data.fireProgress).toMatchObject({
      currentAmount: 7_000_000,
      achievementAxisName: "投資性資産",
      achievementAxisMissing: false,
    });
    expect(result.data.byAxis.investment?.netWorthSeries.at(-1)?.amount).toBe(7_000_000);
  });

  /**
   * **B1-15の不具合が同時に3か所へ出ることを固定するテスト。**
   *
   * 残債の履歴に付く日付は保存した日、資産残高の最新日はCSVを最後に取り込んだ日なので、
   * 負債を登録した直後は「資産残高の最新日 < 負債の最初の履歴日」になる。履歴を「いま」にも
   * 当てると、推移グラフの最新点・円グラフの負債スライス(`debtTotal`)・FIRE達成度ゲージの
   * 現在資産額が揃って「負債なし」と同じ値になり、設定を間違えたのか反映されていないのかを
   * 画面から切り分けられない(docs/screen-requirements-dashboard.md B1)。
   */
  it("資産残高の最新日より後に登録された負債を、推移の最新点・円グラフ・ゲージのすべてに反映する", async () => {
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        ...axes,
        {
          id: "net",
          name: "純資産",
          assetTypeNames: [],
          debtIds: ["debt-1"],
          createdAt: "2026-01-03T00:00:00.000Z",
        },
      ],
    });
    fetchDebts.mockResolvedValue({
      ok: true,
      debts: [
        {
          id: "debt-1",
          name: "住宅ローン",
          balance: 3_000_000,
          interestRate: null,
          repaymentMonths: null,
          updatedAt: "2026-08-20",
          // 資産残高の最新日(2026-08-05)より後の日付しか履歴に無い
          balanceHistory: { "2026-08-20": 3_000_000 },
        },
      ],
    });
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
        achievementAxisId: "net",
      },
    });

    const result = await fetchDashboardData();

    if (!result.ok) {
      throw new Error("取得に失敗した");
    }

    // 推移グラフの最新点(過去の点は履歴に無いので差し引かないまま)
    expect(
      result.data.byAxis.net?.netWorthSeries.map((point) => [point.date, point.amount]),
    ).toEqual([
      ["2026-07-31", 11_000_000],
      ["2026-08-05", 11_400_000 - 3_000_000],
    ]);
    // 円グラフの負債スライスと差引後の純額の元になる値
    expect(result.data.byAxis.net?.debtTotal).toBe(3_000_000);
    // ゲージの現在資産額。推移グラフの最新点と一致する(要件B1の約束)
    expect(result.data.fireProgress?.currentAmount).toBe(11_400_000 - 3_000_000);
  });

  /** 月初は正常にこの状態になる。エラーとしても、取込前の状態としても扱わない */
  it("当月の取引が1件も無ければ収支サマリはnullのまま返す", async () => {
    const result = await fetchDashboardData();

    expect(result).toMatchObject({ ok: true, data: { cashflow: null } });
  });

  it("当月の取引から収支サマリを組み立てる", async () => {
    fetchMonthlyTransactions.mockResolvedValue({
      ok: true,
      truncated: false,
      transactions: [
        buildTransaction({ id: "a", amount: 420_000, categoryMajor: "収入" }),
        buildTransaction({ id: "b", amount: -98_000, categoryMajor: "住居費" }),
        buildTransaction({ id: "c", amount: -3_280, categoryMajor: "食費" }),
      ],
    });

    const result = await fetchDashboardData();

    expect(result).toMatchObject({
      ok: true,
      data: {
        cashflow: {
          income: 420_000,
          // 支出は絶対値で持つ(負のまま渡すと収支が`income + |支出|`になる)
          expense: 101_280,
          expenseByCategory: [
            { name: "住居費", amount: 98_000 },
            { name: "食費", amount: 3_280 },
          ],
        },
      },
    });
  });

  /** 読むのは当月分だけ(docs/transaction-import-requirements.md 8章) */
  it("収支サマリの集計と対象月の判定に同じ時刻を使う", async () => {
    await fetchDashboardData();

    expect(fetchMonthlyTransactions).toHaveBeenCalledWith(expect.any(Date));
  });

  it("CSVも分類軸も無いアカウントでは空のデータを返す(失敗にはしない)", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    fetchAssetSnapshots.mockResolvedValue({ ok: true, snapshots: [] });
    fetchLastImportedAt.mockResolvedValue({ ok: true, lastImportedAt: null });
    fetchFireGoal.mockResolvedValue({ ok: true, goal: null });

    expect(await fetchDashboardData()).toEqual({
      ok: true,
      data: {
        lastImportedAt: null,
        axes: [],
        categories: [],
        byAxis: {},
        debts: [],
        fireProgress: null,
        cashflow: null,
      },
    });
  });

  /** 部分的に欠けた数字を実データとして見せない */
  it("どれか1つでも取得に失敗したら理由付きで失敗を返す", async () => {
    fetchAssetSnapshots.mockResolvedValue({ ok: false, reason: "permission-denied" });

    expect(await fetchDashboardData()).toEqual({ ok: false, reason: "permission-denied" });
  });
});
