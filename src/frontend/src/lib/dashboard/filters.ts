import {
  DASHBOARD_AXIS_PARAM,
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_PARAM,
  DEFAULT_DASHBOARD_PERIOD_ID,
} from "@/constants/dashboard";
import { DASHBOARD_PATH } from "@/constants/routes";

/**
 * URLの`axis`から表示対象の分類軸IDを決める。
 *
 * URLは手で編集できるうえ、B4で分類軸が削除されれば既存のブックマークも指し先を失う。
 * 該当が無ければ先頭の分類軸に落とし、軸が1つも無ければ`undefined`を返す。
 */
export const resolveAxisId = (
  value: string | string[] | undefined,
  axes: AssetCategoryAxis[],
): string | undefined => {
  if (typeof value === "string" && axes.some((axis) => axis.id === value)) {
    return value;
  }

  return axes[0]?.id;
};

/** URLの`period`から表示期間を決める。未指定・不正な値は既定値に落とす */
export const resolvePeriodId = (value: string | string[] | undefined): DashboardPeriodId => {
  const matched = DASHBOARD_PERIODS.find((period) => period.id === value);
  return matched?.id ?? DEFAULT_DASHBOARD_PERIOD_ID;
};

/**
 * 分類軸・表示期間を反映したB1のURLを組み立てる。
 *
 * 片方だけを変えても、もう片方の選択が落ちないよう両方を必ず載せる。
 */
export const buildDashboardHref = (
  axisId: string | undefined,
  periodId: DashboardPeriodId,
): string => {
  const params = new URLSearchParams();

  if (axisId !== undefined) {
    params.set(DASHBOARD_AXIS_PARAM, axisId);
  }

  params.set(DASHBOARD_PERIOD_PARAM, periodId);

  return `${DASHBOARD_PATH}?${params.toString()}`;
};
