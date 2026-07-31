import { addMonths, format, startOfMonth, subDays, subMonths } from "date-fns";

/**
 * B1の見た目を確認するためのサンプルデータ。
 *
 * B2 CSV取込・B4 資産分類マスタ・B8 FIRE目標がまだ無く、Firestoreに実データが存在しないための
 * 一時的な置き換えである。データの繋ぎ込み時にこのファイルごと削除し、
 * `src/lib/dashboard/dashboard-data.ts`の取得元を差し替える。
 *
 * 基準日を引数で受け、同じ基準日なら常に同じ値を返す(乱数を使わない)。
 * 描画のたびに数値が変わるとサーバーとクライアントで表示がずれるため。
 */

/** サンプルの分類マスタ(B4で登録される想定のもの)。並び順がそのまま色の割り当て順になる */
const SAMPLE_CATEGORIES: AssetCategory[] = [
  { id: "fund", name: "投資信託" },
  { id: "deposit", name: "現金・預金" },
  { id: "stock", name: "株式" },
  { id: "real-estate", name: "不動産(利ざや)" },
];

/** サンプルの分類軸(docs/fire-asset-management-requirements.md 4.3の例) */
const SAMPLE_AXES: AssetCategoryAxis[] = [
  { id: "total-assets", name: "総資産" },
  { id: "net-financial-assets", name: "純金融資産" },
  { id: "investment-assets", name: "投資性資産" },
];

/** サンプルの推移を生成する月数(全期間で約5年分) */
const SAMPLE_SERIES_MONTHS = 60;

/** 分類軸ごとの、直近の資産額と分類別の構成比 */
const SAMPLE_AXIS_PROFILES: Record<
  string,
  { latestAmount: number; monthlyGrowthRate: number; composition: Record<string, number> }
> = {
  "total-assets": {
    latestAmount: 49_600_000,
    monthlyGrowthRate: 0.011,
    composition: { fund: 0.45, deposit: 0.25, stock: 0.15, "real-estate": 0.15 },
  },
  "net-financial-assets": {
    latestAmount: 42_160_000,
    monthlyGrowthRate: 0.012,
    composition: { fund: 0.53, deposit: 0.29, stock: 0.18 },
  },
  "investment-assets": {
    latestAmount: 37_200_000,
    monthlyGrowthRate: 0.014,
    composition: { fund: 0.6, stock: 0.2, "real-estate": 0.2 },
  },
};

/**
 * 直近の資産額から過去へさかのぼって推移を作る。
 *
 * 単調に増えるだけでは実データらしくないため、月ごとに一定の振れ幅を加える。
 * 振れ幅は月インデックスから決めており、呼び出すたびに変わることはない。
 */
const buildNetWorthSeries = (
  latestAmount: number,
  monthlyGrowthRate: number,
  now: Date,
): NetWorthPoint[] => {
  const latestMonth = startOfMonth(now);

  return Array.from({ length: SAMPLE_SERIES_MONTHS }, (_, index) => {
    const monthsBack = SAMPLE_SERIES_MONTHS - 1 - index;
    const trend = latestAmount / (1 + monthlyGrowthRate) ** monthsBack;
    // 4か月周期の緩やかな上下。相場の振れをそれらしく見せるためだけのもの
    const wobble = 1 + 0.015 * Math.sin((monthsBack * Math.PI) / 2);

    return {
      date: format(subMonths(latestMonth, monthsBack), "yyyy-MM-dd"),
      amount: Math.round((trend * wobble) / 10_000) * 10_000,
    };
  });
};

const buildBreakdown = (
  latestAmount: number,
  composition: Record<string, number>,
): AssetBreakdownEntry[] =>
  SAMPLE_CATEGORIES.filter((category) => composition[category.id] !== undefined).map(
    (category) => ({
      categoryId: category.id,
      amount: Math.round((latestAmount * (composition[category.id] ?? 0)) / 10_000) * 10_000,
    }),
  );

/** サンプルの当月収支 */
const buildCashflow = (now: Date): CashflowSummary => ({
  month: format(now, "yyyy-MM"),
  income: 420_000,
  expense: 285_300,
  expenseByCategory: [
    { name: "住居費", amount: 98_000 },
    { name: "食費", amount: 62_400 },
    { name: "水道・光熱費", amount: 24_800 },
    { name: "交通費", amount: 21_000 },
    { name: "その他", amount: 79_100 },
  ],
});

/** B1に流し込むサンプルデータ一式を組み立てる */
export const createSampleDashboardData = (now: Date): DashboardData => {
  const byAxis = Object.fromEntries(
    SAMPLE_AXES.map((axis) => {
      const profile = SAMPLE_AXIS_PROFILES[axis.id];

      if (profile === undefined) {
        return [axis.id, { netWorthSeries: [], breakdown: [] }];
      }

      return [
        axis.id,
        {
          netWorthSeries: buildNetWorthSeries(profile.latestAmount, profile.monthlyGrowthRate, now),
          breakdown: buildBreakdown(profile.latestAmount, profile.composition),
        },
      ];
    }),
  );

  return {
    lastImportedAt: subDays(now, 11).toISOString(),
    axes: SAMPLE_AXES,
    categories: SAMPLE_CATEGORIES,
    byAxis,
    fireProgress: {
      targetAmount: 80_000_000,
      currentAmount: SAMPLE_AXIS_PROFILES["total-assets"]?.latestAmount ?? 0,
      // B9の想定利回りを前提に算出される値。ここでは算出済みの結果を置いているだけ
      projectedAchievementDate: format(startOfMonth(addMonths(now, 81)), "yyyy-MM-dd"),
    },
    cashflow: buildCashflow(now),
  };
};
