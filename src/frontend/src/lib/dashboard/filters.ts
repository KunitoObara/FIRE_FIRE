import {
  DASHBOARD_AXIS_PARAM,
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_PARAM,
  DASHBOARD_TREND_PARAM,
  DEFAULT_DASHBOARD_PERIOD_ID,
  DEFAULT_NET_WORTH_TREND_MODE_ID,
  NET_WORTH_TREND_MODES,
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
 * URLの`trend`から資産推移グラフの表示を決める。未指定・不正な値は既定(積み上げ)に落とす
 * (docs/screen-requirements-dashboard.md B1「資産推移グラフの表示切替」)。
 * 表示期間の解決と同じ形にしてある。
 */
export const resolveTrendModeId = (value: string | string[] | undefined): NetWorthTrendModeId => {
  const matched = NET_WORTH_TREND_MODES.find((mode) => mode.id === value);
  return matched?.id ?? DEFAULT_NET_WORTH_TREND_MODE_ID;
};

/**
 * 分類軸・表示期間・資産推移の表示を反映したB1のURLを組み立てる。
 *
 * **3つとも必ず載せる。** 1つだけを変えたときに他の選択が落ちないようにするため
 * (資産推移の表示は切替UIの置き場所がカードの中で別だが、URLの扱いは同じ)。
 */
export const buildDashboardHref = (
  axisId: string | undefined,
  periodId: DashboardPeriodId,
  trendMode: NetWorthTrendModeId,
): string => {
  const params = new URLSearchParams();

  if (axisId !== undefined) {
    params.set(DASHBOARD_AXIS_PARAM, axisId);
  }

  params.set(DASHBOARD_PERIOD_PARAM, periodId);
  params.set(DASHBOARD_TREND_PARAM, trendMode);

  return `${DASHBOARD_PATH}?${params.toString()}`;
};
