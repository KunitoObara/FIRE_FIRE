import { format, parseISO } from "date-fns";

import {
  ACHIEVED_PROJECTION_LABEL,
  NO_PROJECTED_DATE_LABEL,
  UNREACHABLE_PROJECTION_LABEL,
} from "@/constants/dashboard";
import { DEFAULT_ACHIEVEMENT_AXIS_NAME } from "@/constants/fire-goal";
import {
  resolveAxisDebts,
  resolveAxisProperties,
  sumAxisAmount,
  sumDebtBalance,
  sumPropertyAmount,
} from "@/lib/dashboard/aggregation";
import { buildFireProjection, resolveProjectionBase } from "@/lib/dashboard/fire-projection";
import { resolveFireGoalTargetAmount } from "@/lib/fire-goal/calculation";

/**
 * 達成度の対象分類(B8)を、集計に使える形へ解決する。
 *
 * 設定されている分類軸がB4で削除されていた場合は既定(総資産)へフォールバックし、
 * フォールバックしたこと自体を`missing`で返す。ゲージを消したり0%にしたりはしない
 * (docs/screen-requirements-dashboard.md B1)。計算できなくなったのではなく比較対象が
 * 失われただけであり、黙って基準を変えると気付かないまま別の達成率を見続けることになる。
 *
 * B1のゲージとB8の参考表示の両方から呼ぶ。解決を1か所に置かないと、同じ設定に対して
 * 画面ごとに違う分類名や金額が出うる。
 */
export const resolveAchievementAxis = (
  achievementAxisId: string | null,
  axes: AchievementAxisOption[],
): AchievementAxisResolution => {
  if (achievementAxisId === null) {
    return {
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      debtIds: [],
      propertyValuations: {},
      missing: false,
    };
  }

  const axis = axes.find((option) => option.id === achievementAxisId);

  if (axis === undefined) {
    return {
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      debtIds: [],
      propertyValuations: {},
      missing: true,
    };
  }

  return {
    name: axis.name,
    assetTypeNames: axis.assetTypeNames,
    debtIds: axis.debtIds,
    propertyValuations: axis.propertyValuations,
    missing: false,
  };
};

/**
 * 対象分類の現在資産額を直近の資産残高から求める。資産残高が無ければ`null`。
 *
 * **既定(総資産)のときだけはCSVの「合計（円）」列(`total`)を採り、資産種別の
 * 足し合わせでは求めない。** 分類軸の集計(`sumAxisAmount`)がその逆を採っているのは
 * 意図した使い分けで、理由が別にある。
 *
 * - 分類軸は資産種別の部分集合を指すため、合計を出せる値が足し合わせしか無い
 * - 総資産は本家(マネーフォワード)が出している額そのものを見せる。どこまでを合計に
 *   含めるかを画面側で推測して再計算すると本家と食い違う(src/lib/csv/asset-balance-csv.ts)
 *
 * そのため、集計対象を空にした「総資産」相当の分類軸を対象分類に選ぶと、既定を選んだ
 * 場合とわずかにずれることがある。ずれるのはマネーフォワードの合計に資産種別の列として
 * 現れない額が含まれる場合だけで、そのときはCSVの合計側が正しい(要件B1・既知)。
 *
 * 逆に、分類軸を選んだときは資産推移グラフ・分類別内訳と同じ`sumAxisAmount`で集計する。
 * B1のセレクタで同じ分類軸を選んだときに、推移グラフの最新点とゲージの現在資産額が
 * 一致することを、集計方法を共有することで保証する。
 *
 * **差し引くのは現在の残債(`sumDebtBalance`)。** ここは「いま」を表す表示なので、
 * 履歴から直近の資産残高の日の残債を引く形にはしない
 * (docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。推移グラフの
 * 最新点も同じ値を引いており、上記の一致はその一致でもある。
 */
export const resolveAchievementAmount = (
  resolution: AchievementAxisResolution,
  latest: AssetSnapshot | undefined,
  debts: Debt[],
  properties: RealEstateProperty[],
): number | null => {
  if (latest === undefined) {
    return null;
  }

  /*
    既定(総資産)はCSVの「合計(円)」列をそのまま採るため、**手動で登録した不動産は
    入らない**(docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
    含めたい場合はB4で物件を選んだ分類軸を作り、B8の対象分類に指定する
  */
  return resolution.assetTypeNames === null
    ? latest.total
    : sumAxisAmount(
        latest,
        resolution.assetTypeNames,
        sumDebtBalance(resolveAxisDebts(debts, resolution.debtIds)),
        sumPropertyAmount(
          resolveAxisProperties(properties, resolution.propertyValuations),
          resolution.propertyValuations,
        ),
      );
};

/**
 * 保存済みのFIRE目標(B8)と直近の資産残高から、ゲージの表示値を組み立てる。
 *
 * 目標資産額の解決は`resolveFireGoalTargetAmount`に任せる。「直接入力と逆算のどちらが
 * 有効か」の判断をB8の参考表示とB1のゲージで別々に持つと、同じ目標額が画面によって
 * 違う値になりうるため。
 *
 * 現在資産額は**B1の分類軸切替セレクタには追従しないが、B8で設定した達成度の対象分類には
 * 従う**(docs/screen-requirements-dashboard.md B1「FIRE達成度の現在資産額(対象分類)」)。
 * どの分類軸で見るかは目標とセットの設定であり、B1のセレクタに追従させると同じ目標に
 * 対する達成率が画面上の切替ひとつで別の値になるため。
 *
 * CSVが未取込で直近の資産残高が無い場合は0円として扱う。ここで`null`(=目標未設定)に
 * 倒すと、目標を設定済みのユーザーに「FIRE目標が未設定です」と出てしまうため。
 * 未取込であることは同じ画面の「直近CSV取込」が示す。
 */
export const buildFireProgress = ({
  goal,
  latest,
  axes,
  debts,
  properties,
  assumptions,
  now,
}: BuildFireProgressInput): FireProgress | null => {
  if (!goal) {
    return null;
  }

  const targetAmount = resolveFireGoalTargetAmount(goal);

  // 0は目標額として成立しない(達成率が定義できない)ので、`null`と同じく未設定として扱う
  if (!targetAmount) {
    return null;
  }

  const resolution = resolveAchievementAxis(goal.achievementAxisId, axes);

  return {
    targetAmount,
    currentAmount: resolveAchievementAmount(resolution, latest, debts, properties) ?? 0,
    achievementAxisName: resolution.name,
    achievementAxisMissing: resolution.missing,
    /*
      B9の想定値を取得できなかった場合だけ予測を出さない(「算出できません」)。
      前提の解決そのものに失敗した場合の保険で、ダッシュボードの他のカードは巻き込まない
      (docs/screen-requirements-fire-goal.md「到達予測日の算出」)。

      積立額を持たない目標(この欄を導入する前に保存されたもの)は0として扱う。同要件。
    */
    projection:
      assumptions === null
        ? null
        : buildFireProjection({
            targetAmount,
            ...resolveProjectionBase(resolution, latest, debts, properties),
            monthlyContribution: goal.monthlyContribution ?? 0,
            assumptions,
            now,
          }),
  };
};

/**
 * FIRE達成率を求める(B1のFIRE達成度ゲージ)。
 *
 * 戻り値は0〜1の比率であり、パーセントではない。表示側で100倍する。
 * 目標資産額が0以下だと比率が定義できないため`null`を返し、画面は「未設定」の扱いにする。
 *
 * 目標を超過している場合も実際の比率(1超)をそのまま返す。ゲージの塗りは表示側で100%に丸めるが、
 * 「目標の何割か」という数値自体を切り捨ててしまうと超過分が見えなくなるため。
 */
export const calculateAchievementRate = (
  currentAmount: number,
  targetAmount: number,
): number | null => {
  if (targetAmount <= 0) {
    return null;
  }

  return currentAmount / targetAmount;
};

/**
 * 達成率をゲージの塗り(0〜1)へ変換する。
 * 目標超過で円が1周を超えて描かれないよう上限で止め、下振れ(負の資産)も0で止める。
 */
export const toGaugeRatio = (achievementRate: number): number =>
  Math.min(Math.max(achievementRate, 0), 1);

/**
 * 中央に出す達成率(%)へ変換する。
 *
 * **下振れ側だけ0で止め、目標超過は丸めない。上下で扱いを分けているのは意図**
 * (DESIGN.md 9章)。
 *
 * - 負の達成率をそのまま出すと、0で止まっているリングと数値が食い違い、同じ瞬間に
 *   2つの違う達成率が画面に出る。「目標からどれだけ遠いか」は併記する現在資産額が示すので、
 *   0%に丸めても失うものが無い(docs/screen-requirements-dashboard.md B1)
 * - 超過側を丸めると`120%`が`100%`になり、超過分が画面から消える。こちらは丸めることで
 *   情報が失われるため、リングだけ1周で止めて数値は実際の比率を出す
 *
 * 0%は「まだ何も貯まっていない」状態でも出る値なので、負債が資産を上回っていることは
 * カード側が注記で示す(`FireProgressCard`)。
 */
export const toDisplayAchievementRate = (achievementRate: number): number =>
  Math.max(achievementRate, 0);

/**
 * 到達予測を画面に出す文言へ整形する(docs/screen-requirements-dashboard.md B1「到達予測日」)。
 *
 * 到達月は「2033年4月頃」の粒度にする。予測値であって確定日ではないため「頃」を添え、
 * 日付までは出さない。「達成済み」「到達見込みなし」を同じ表示にまとめないのは、
 * ユーザーが次に取る行動が変わるため(正本「結果の区別」)。
 *
 * 日付として読めない値も「算出できません」に倒す。`null`と同じく前提の解決に失敗した
 * 場合の保険で、通常は起こらない。
 */
export const formatFireProjection = (projection: FireProjection | null): string => {
  if (projection === null) {
    return NO_PROJECTED_DATE_LABEL;
  }

  if (projection.status === "achieved") {
    return ACHIEVED_PROJECTION_LABEL;
  }

  if (projection.status === "unreachable") {
    return UNREACHABLE_PROJECTION_LABEL;
  }

  const parsed = parseISO(projection.achievementDate);

  if (Number.isNaN(parsed.getTime())) {
    return NO_PROJECTED_DATE_LABEL;
  }

  return `${format(parsed, "yyyy年M月")}頃`;
};
