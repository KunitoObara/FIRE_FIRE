import { parseISO, startOfDay, subYears } from "date-fns";

import { DASHBOARD_PERIODS } from "@/constants/dashboard";

/**
 * 総資産推移を表示期間で絞り込む(B1の表示期間切替)。
 *
 * 境界は「現在からN年前の同日以降」とし、その日ちょうどの点は含める。
 * 「全期間」は絞り込まずそのまま返す。
 *
 * 境界は日付の頭に丸める。丸めないと、同じ日でも画面を開いた時刻によって
 * ちょうどN年前の点が入ったり入らなかったりする。
 */
export const filterSeriesByPeriod = (
  series: NetWorthPoint[],
  periodId: DashboardPeriodId,
  now: Date,
): NetWorthPoint[] => {
  const period = DASHBOARD_PERIODS.find((candidate) => candidate.id === periodId);

  if (period === undefined || period.years === null) {
    return series;
  }

  const since = startOfDay(subYears(now, period.years));

  return series.filter((point) => parseISO(point.date).getTime() >= since.getTime());
};
