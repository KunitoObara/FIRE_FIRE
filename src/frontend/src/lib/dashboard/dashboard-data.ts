import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import { fetchAssumptions } from "@/lib/assumptions/assumption-repository";
import {
  fetchAssetSnapshots,
  fetchLastImportedAt,
} from "@/lib/csv-import/asset-balance-repository";
import {
  buildAxisBreakdown,
  buildAxisNetWorthSeries,
  collectAssetCategories,
  resolveAxisDebts,
  resolveAxisProperties,
  sumDebtBalance,
  sumPropertyAmount,
} from "@/lib/dashboard/aggregation";
import { buildFireProgress } from "@/lib/dashboard/fire-progress";
import { fetchDebts } from "@/lib/debts/debt-repository";
import { fetchFireGoal } from "@/lib/fire-goal/fire-goal-repository";
import { fetchRealEstateProperties } from "@/lib/real-estate/property-repository";

/**
 * B1が表示するデータを、各画面が書き込んだFirestoreのデータから組み立てる。
 *
 * ```
 * users/{uid}/categoryAxes      B4 資産分類マスタ   分類軸切替セレクタ・集計対象の資産種別
 * users/{uid}/assetSnapshots    B2 CSV取込          資産推移グラフ・分類別内訳・現在資産額
 * users/{uid}/csvImports        B2 CSV取込          直近CSV取込日時
 * users/{uid}/settings/fireGoal B8 FIRE目標設定     FIRE達成度ゲージ・到達予測日
 * users/{uid}/settings/assumptions B9 想定利回り    到達予測日
 * users/{uid}/debts             B11 負債入力        負債サマリ・負債を含む分類軸の集計
 * users/{uid}/properties        B5〜B7 不動産       不動産を含む分類軸の集計
 * ```
 *
 * **収支サマリ(`users/{uid}/transactions`)はここでは読まない。** 対象の月は画面上で選べるので、
 * 一括取得に混ぜると年月を切り替えるたびに資産残高・分類軸・負債・FIRE目標まで読み直すことに
 * なる。取引の取得は`fetchCashflowData`が月ごとに持つ
 * (docs/screen-requirements-dashboard.md B1「年月の選択」)。
 *
 * 7つの取得は互いに独立しているので並列に投げる。順に待つと、いちばん遅いものだけでなく
 * 合計の待ち時間がログイン直後の最初の画面に乗る。
 *
 * **失敗の扱いは想定利回り(B9)だけ違う。** 他の6つはどれか1つでも失敗したら画面全体を
 * 失敗として返すが、想定利回りが効くのは到達予測日の欄だけなので、そこだけを
 * 「算出できません」に倒して残りは出す(下記)。
 */
export const fetchDashboardData = async (): Promise<DashboardDataResult> => {
  const [
    axesResult,
    snapshotsResult,
    lastImportedAtResult,
    fireGoalResult,
    debtsResult,
    propertiesResult,
    assumptionsResult,
  ] = await Promise.all([
    fetchCategoryAxes(),
    fetchAssetSnapshots(),
    fetchLastImportedAt(),
    fetchFireGoal(),
    fetchDebts(),
    fetchRealEstateProperties(),
    fetchAssumptions(),
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

  if (!propertiesResult.ok) {
    return propertiesResult;
  }

  const { snapshots } = snapshotsResult;
  const { debts } = debtsResult;
  const { properties } = propertiesResult;
  // 日付の昇順で返るので、末尾が直近の資産残高になる
  const latest = snapshots.at(-1);
  /*
    **想定利回り(B9)だけは失敗しても画面全体を止めない。** これが効くのは到達予測日の欄
    だけなので、読めないことを理由に資産推移・内訳・収支まで消すと失うものが大きい。
    予測は「算出できません」に倒れる(docs/screen-requirements-fire-goal.md「到達予測日の算出」が
    その表示を前提の解決に失敗した場合の保険として残している)
  */
  const assumptions = assumptionsResult.ok ? assumptionsResult.assumptions : null;
  /*
    予測の起点(当月)。ここで1度だけ作る。月をまたぐ瞬間に別々の`new Date()`を使うと、
    同じ取得の中で起点の違う予測が混じりうる
  */
  const now = new Date();

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
          // 削除された物件への参照も同じく落ちる(B4「集計対象に不動産を含める」)
          const axisProperties = resolveAxisProperties(properties, axis.propertyValuations);

          return [
            axis.id,
            {
              netWorthSeries: buildAxisNetWorthSeries(
                snapshots,
                axis.assetTypeNames,
                axisDebts,
                axisProperties,
                axis.propertyValuations,
              ),
              breakdown: latest ? buildAxisBreakdown(latest, axis.assetTypeNames) : [],
              /*
                円グラフは「いま何をどれだけ持っているか」なので、履歴ではなく現在の残債を
                引く(docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
                推移グラフの最新点・FIRE達成度ゲージも同じ`sumDebtBalance`を使う。
                履歴の時点で引くと、資産残高の最新日より後に負債を保存した直後に、
                同じ画面の3か所が揃って「負債なし」と同じ表示になる
              */
              debtTotal: latest ? sumDebtBalance(axisDebts) : 0,
              /*
                不動産も「いま」の額を使う(負債と同じ理由)。円グラフのスライスと純額の
                併記、推移グラフの最新点が同じ値を指す
              */
              propertyTotal: latest
                ? sumPropertyAmount(axisProperties, axis.propertyValuations)
                : 0,
              /*
                「資産のみ」でも利ざやの物件はローン控除後のまま積まれる旨の注記を出すか
                (同要件「負債反映の切替との関係」)。削除済みの物件への参照は数えない
              */
              hasSpreadProperty: axisProperties.some(
                (property) => axis.propertyValuations[property.id] === "spread",
              ),
            },
          ];
        }),
      ),
      // 負債サマリは分類軸で絞らず登録済みの負債をそのまま並べる(同要件B1「負債サマリ」)
      debts,
      /*
        分類別内訳の凡例に添えるリスクレベル(同要件B1「リスクの可視化」)。取得に失敗した
        場合は空にする。凡例には「取得できなかった」を示す場所が無く、リスクを1件も
        設定していない状態と同じ見た目になるだけで困らない(到達予測日と扱いが違うのは、
        あちらには示す欄があるため)
      */
      assumptions: assumptions ?? {},
      // ゲージの現在資産額はB1のセレクタではなくB8の対象分類で集計する。分類軸の一覧を
      // 渡すのは、設定された軸がB4で削除されていたときに既定へフォールバックさせるため。
      // 負債は対象分類が負債を含む軸のときだけ差し引かれる。到達予測も同じ対象分類から出す
      fireProgress: buildFireProgress({
        goal: fireGoalResult.goal,
        latest,
        axes: axesResult.axes,
        debts,
        properties,
        assumptions,
        now,
      }),
    },
  };
};
