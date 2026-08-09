import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDashboardData } from "@/lib/dashboard/dashboard-data";

const fetchCategoryAxes = vi.fn();
const fetchAssetSnapshots = vi.fn();
const fetchLastImportedAt = vi.fn();
const fetchFireGoal = vi.fn();
const fetchDebts = vi.fn();

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

    expect(result.data.byAxis.total?.netWorthSeries).toEqual([
      { date: "2026-07-31", amount: 11_000_000 },
      { date: "2026-08-05", amount: 11_400_000 },
    ]);
    expect(result.data.byAxis.investment?.netWorthSeries).toEqual([
      { date: "2026-07-31", amount: 6_800_000 },
      { date: "2026-08-05", amount: 7_000_000 },
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

  /** 入出金明細の取込(B3)はPhase 2。ここで埋めるデータが無い */
  it("収支サマリはnullのまま返す", async () => {
    const result = await fetchDashboardData();

    expect(result).toMatchObject({ ok: true, data: { cashflow: null } });
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
