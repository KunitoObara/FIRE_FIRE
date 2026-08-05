import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import {
  fetchAssetSnapshots,
  fetchLastImportedAt,
} from "@/lib/csv-import/asset-balance-repository";
import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  collectAssetCategories,
} from "@/lib/dashboard/aggregation";
import { buildFireProgress } from "@/lib/dashboard/fire-progress";
import { fetchFireGoal } from "@/lib/fire-goal/fire-goal-repository";

/**
 * B1が表示するデータを、各画面が書き込んだFirestoreのデータから組み立てる。
 *
 * ```
 * users/{uid}/categoryAxes      B4 資産分類マスタ   分類軸切替セレクタ・集計対象の資産種別
 * users/{uid}/assetSnapshots    B2 CSV取込          資産推移グラフ・分類別内訳・現在資産額
 * users/{uid}/csvImports        B2 CSV取込          直近CSV取込日時
 * users/{uid}/settings/fireGoal B8 FIRE目標設定     FIRE達成度ゲージ
 * ```
 *
 * 収支サマリ(`cashflow`)はB3 入出金明細の取込が前提なので`null`のまま返す(Phase 2)。
 *
 * 4つの取得は互いに独立しているので並列に投げる。順に待つと、いちばん遅いものだけでなく
 * 合計の待ち時間がログイン直後の最初の画面に乗る。
 */
export const fetchDashboardData = async (): Promise<DashboardDataResult> => {
  const [axesResult, snapshotsResult, lastImportedAtResult, fireGoalResult] = await Promise.all([
    fetchCategoryAxes(),
    fetchAssetSnapshots(),
    fetchLastImportedAt(),
    fetchFireGoal(),
  ]);

  // どれか1つでも失敗したら画面全体を失敗として返す。失敗の原因(未ログイン・権限・設定)は
  // 4つに共通するものばかりで、部分的に欠けた数字を実データとして見せる方が危うい
  if (!axesResult.ok) {
    return axesResult;
  }

  if (!snapshotsResult.ok) {
    return snapshotsResult;
  }

  if (!lastImportedAtResult.ok) {
    return lastImportedAtResult;
  }

  if (!fireGoalResult.ok) {
    return fireGoalResult;
  }

  const { snapshots } = snapshotsResult;
  // 日付の昇順で返るので、末尾が直近の資産残高になる
  const latest = snapshots.at(-1);

  return {
    ok: true,
    data: {
      lastImportedAt: lastImportedAtResult.lastImportedAt,
      axes: axesResult.axes.map((axis) => ({ id: axis.id, name: axis.name })),
      categories: collectAssetCategories(latest),
      byAxis: Object.fromEntries(
        axesResult.axes.map((axis) => [
          axis.id,
          {
            netWorthSeries: buildAxisNetWorthSeries(snapshots, axis.assetTypeNames),
            breakdown: latest === undefined ? [] : buildAxisBreakdown(latest, axis.assetTypeNames),
          },
        ]),
      ),
      fireProgress: buildFireProgress(fireGoalResult.goal, latest?.total ?? null),
      cashflow: null,
    },
  };
};
