import { format, parseISO } from "date-fns";

import { NO_PROJECTED_DATE_LABEL } from "@/constants/dashboard";
import { resolveFireGoalTargetAmount } from "@/lib/fire-goal/calculation";

/**
 * 保存済みのFIRE目標(B8)と直近の資産残高から、ゲージの表示値を組み立てる。
 *
 * 目標資産額の解決は`resolveFireGoalTargetAmount`に任せる。「直接入力と逆算のどちらが
 * 有効か」の判断をB8の参考表示とB1のゲージで別々に持つと、同じ目標額が画面によって
 * 違う値になりうるため。
 *
 * 現在資産額は分類軸の影響を受けない(docs/screen-requirements-dashboard.md B1)。
 * 目標資産額は資産全体に対する目標であり、B8の参考表示も同じ`total`を見ている。
 *
 * **資産全体の額だけはCSVの「合計（円）」列(`total`)を採り、資産種別の足し合わせでは
 * 求めない。** 分類軸の集計(`sumAxisAmount`)がその逆を採っているのは意図した使い分けで、
 * 理由が別にある。
 *
 * - 分類軸は資産種別の部分集合を指すため、合計を出せる値が足し合わせしか無い
 * - 資産全体は本家(マネーフォワード)が出している額そのものを見せる。どこまでを合計に
 *   含めるかを画面側で推測して再計算すると本家と食い違う(src/lib/csv/asset-balance-csv.ts)
 *
 * そのため、集計対象を空にした「総資産」相当の分類軸を登録すると、資産推移グラフの
 * 最新点とこのカードの現在資産額がわずかにずれることがある。ずれるのは
 * マネーフォワードの合計に資産種別の列として現れない額が含まれる場合だけで、
 * そのときはCSVの合計側が正しい。
 *
 * CSVが未取込で直近の資産残高が無い場合は0円として扱う。ここで`null`(=目標未設定)に
 * 倒すと、目標を設定済みのユーザーに「FIRE目標が未設定です」と出てしまうため。
 * 未取込であることは同じ画面の「直近CSV取込」が示す。
 */
export const buildFireProgress = (
  goal: FireGoal | null,
  latestAssetTotal: number | null,
): FireProgress | null => {
  if (!goal) {
    return null;
  }

  const targetAmount = resolveFireGoalTargetAmount(goal);

  // 0は目標額として成立しない(達成率が定義できない)ので、`null`と同じく未設定として扱う
  if (!targetAmount) {
    return null;
  }

  return {
    targetAmount,
    currentAmount: latestAssetTotal ?? 0,
    // 到達予測日は想定利回り(B9)を前提とする別の計算なので、ここでは算出しない
    projectedAchievementDate: null,
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
 * 到達予測日を「2033年4月頃」の形に整形する。
 *
 * 予測値であって確定日ではないため「頃」を添え、日付までは出さない。
 * 予測の算出そのものは想定利回り(B9)を前提とするため、B1では行わない。
 */
export const formatProjectedAchievementDate = (isoDate: string | null): string => {
  if (isoDate === null) {
    return NO_PROJECTED_DATE_LABEL;
  }

  const parsed = parseISO(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return NO_PROJECTED_DATE_LABEL;
  }

  return `${format(parsed, "yyyy年M月")}頃`;
};
