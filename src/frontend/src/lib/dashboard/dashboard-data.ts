import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import {
  fetchAssetSnapshots,
  fetchLastImportedAt,
} from "@/lib/csv-import/asset-balance-repository";
import { fetchMonthlyTransactions } from "@/lib/csv-import/transaction-repository";
import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  buildCashflowSummary,
  collectAssetCategories,
  resolveAxisDebts,
  sumDebtBalance,
} from "@/lib/dashboard/aggregation";
import { buildFireProgress } from "@/lib/dashboard/fire-progress";
import { fetchDebts } from "@/lib/debts/debt-repository";
import { fetchFireGoal } from "@/lib/fire-goal/fire-goal-repository";

/**
 * B1が表示するデータを、各画面が書き込んだFirestoreのデータから組み立てる。
 *
 * ```
 * users/{uid}/categoryAxes      B4 資産分類マスタ   分類軸切替セレクタ・集計対象の資産種別
 * users/{uid}/assetSnapshots    B2 CSV取込          資産推移グラフ・分類別内訳・現在資産額
 * users/{uid}/csvImports        B2 CSV取込          直近CSV取込日時
 * users/{uid}/settings/fireGoal B8 FIRE目標設定     FIRE達成度ゲージ
 * users/{uid}/debts             B11 負債入力        負債サマリ・負債を含む分類軸の集計
 * users/{uid}/transactions      B2 CSV取込          収支サマリ(当月分のみ)
 * ```
 *
 * 取引だけは**当月分しか読まない**(docs/transaction-import-requirements.md 8章)。
 * 収支サマリが出すのが当月の収入・支出・費目別支出であり、取引は月に数百件のペースで
 * 積み上がるため、全件を読むと表示のたびに読み取りが増え続ける。
 *
 * 6つの取得は互いに独立しているので並列に投げる。順に待つと、いちばん遅いものだけでなく
 * 合計の待ち時間がログイン直後の最初の画面に乗る。
 */
export const fetchDashboardData = async (): Promise<DashboardDataResult> => {
  // 収支サマリの集計と対象月の判定は同じ時刻から出す。別々に`new Date()`を呼ぶと、
  // 月をまたぐ瞬間に「先月の取引を今月として集計する」ずれが起きうる
  const now = new Date();

  const [
    axesResult,
    snapshotsResult,
    lastImportedAtResult,
    fireGoalResult,
    debtsResult,
    monthlyTransactionsResult,
  ] = await Promise.all([
    fetchCategoryAxes(),
    fetchAssetSnapshots(),
    fetchLastImportedAt(),
    fetchFireGoal(),
    fetchDebts(),
    fetchMonthlyTransactions(now),
  ]);

  // どれか1つでも失敗したら画面全体を失敗として返す。失敗の原因(未ログイン・権限・設定)は
  // どの取得にも共通するものばかりで、部分的に欠けた数字を実データとして見せる方が危うい
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

  if (!debtsResult.ok) {
    return debtsResult;
  }

  if (!monthlyTransactionsResult.ok) {
    return monthlyTransactionsResult;
  }

  const { snapshots } = snapshotsResult;
  const { debts } = debtsResult;
  // 日付の昇順で返るので、末尾が直近の資産残高になる
  const latest = snapshots.at(-1);

  return {
    ok: true,
    data: {
      lastImportedAt: lastImportedAtResult.lastImportedAt,
      axes: axesResult.axes.map((axis) => ({ id: axis.id, name: axis.name })),
      categories: collectAssetCategories(latest),
      byAxis: Object.fromEntries(
        axesResult.axes.map((axis) => {
          // 分類軸が参照している負債がB11で削除されていた場合は、ここで落ちる
          const axisDebts = resolveAxisDebts(debts, axis.debtIds);

          return [
            axis.id,
            {
              netWorthSeries: buildAxisNetWorthSeries(snapshots, axis.assetTypeNames, axisDebts),
              breakdown: latest ? buildAxisBreakdown(latest, axis.assetTypeNames) : [],
              /*
                円グラフは「いま何をどれだけ持っているか」なので、履歴ではなく現在の残債を
                引く(docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
                推移グラフの最新点・FIRE達成度ゲージも同じ`sumDebtBalance`を使う。
                履歴の時点で引くと、資産残高の最新日より後に負債を保存した直後に、
                同じ画面の3か所が揃って「負債なし」と同じ表示になる
              */
              debtTotal: latest ? sumDebtBalance(axisDebts) : 0,
            },
          ];
        }),
      ),
      // 負債サマリは分類軸で絞らず登録済みの負債をそのまま並べる(同要件B1「負債サマリ」)
      debts,
      // ゲージの現在資産額はB1のセレクタではなくB8の対象分類で集計する。分類軸の一覧を
      // 渡すのは、設定された軸がB4で削除されていたときに既定へフォールバックさせるため。
      // 負債は対象分類が負債を含む軸のときだけ差し引かれる
      fireProgress: buildFireProgress(fireGoalResult.goal, latest, axesResult.axes, debts),
      /*
        収支サマリは当月固定で、分類軸切替セレクタにも表示期間切替にも従わない(同要件B1)。
        入出金明細の集計であって資産の分類軸とは別の軸のため、`byAxis`の中には入れない
      */
      cashflow: buildCashflowSummary(monthlyTransactionsResult.transactions, now),
    },
  };
};
