import { format, parseISO } from "date-fns";

import { NO_PROJECTED_DATE_LABEL } from "@/constants/dashboard";

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
