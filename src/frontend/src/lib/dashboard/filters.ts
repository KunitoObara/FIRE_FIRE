import {
  DASHBOARD_AXIS_PARAM,
  DASHBOARD_MONTH_PARAM,
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_PARAM,
  DASHBOARD_DEBT_PARAM,
  DEFAULT_DASHBOARD_PERIOD_ID,
  DEFAULT_NET_WORTH_TREND_MODE_ID,
  NET_WORTH_TREND_MODES,
} from "@/constants/dashboard";
import { DASHBOARD_PATH } from "@/constants/routes";
import { isMonthKey, toMonthKey } from "@/lib/dashboard/month";

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
 * URLの`debt`から負債を反映するかどうかを決める。未指定・不正な値は既定(反映ON)に落とす
 * (docs/screen-requirements-dashboard.md B1「資産推移グラフの負債反映切替」)。
 * 表示期間の解決と同じ形にしてある。
 */
export const resolveTrendModeId = (value: string | string[] | undefined): NetWorthTrendModeId => {
  const matched = NET_WORTH_TREND_MODES.find((mode) => mode.id === value);
  return matched?.id ?? DEFAULT_NET_WORTH_TREND_MODE_ID;
};

/**
 * URLの`month`から収支サマリの対象月を決める(docs/screen-requirements-dashboard.md B1
 * 「年月の選択」)。**既定は当月。**
 *
 * 未指定・`yyyy-MM`として読めない値・**当月より後の月**は当月に落とす(分類軸・表示期間の
 * 解決と同じ「不正な値は既定へ」)。未来の月を当月に丸めるのは、マネーフォワードの入出金明細が
 * 発生済みの取引を書き出すもので、未来の月には数える取引が無いため。ピッカー側で未来の月を
 * 押せないようにしているのも同じ理由で、そちらと判定の基準を揃える。
 *
 * **下限は設けない。** 取り込んである最も古い月をこの画面は知らない(読むのは選択中の
 * 1ヶ月だけ。docs/transaction-import-requirements.md 8章)。
 *
 * 比較は文字列のまま行う。`yyyy-MM`は桁が揃っているので辞書順が時系列順になり、
 * `isMonthKey`が月を01〜12に絞っているので`2026-13`のような値がここへ来ることはない。
 */
export const resolveMonthId = (value: string | string[] | undefined, now: Date): string => {
  const currentMonth = toMonthKey(now);

  if (typeof value === "string" && isMonthKey(value) && value <= currentMonth) {
    return value;
  }

  return currentMonth;
};

/**
 * 分類軸・表示期間・負債の反映・対象月を反映したB1のURLを組み立てる。
 *
 * **4つとも必ず載せる。** 1つだけを変えたときに他の選択が落ちないようにするため
 * (負債の反映と対象月は切替UIの置き場所がカードの中で別だが、URLの扱いは同じ)。
 *
 * 引数を1つのオブジェクトで受けるのは、位置引数が4つ並ぶと呼び出し側で順番を取り違えても
 * 型で気付けない(`string`と`string`が隣り合う)ため。
 */
export const buildDashboardHref = ({
  axisId,
  periodId,
  trendMode,
  month,
}: DashboardHrefParams): string => {
  const params = new URLSearchParams();

  if (axisId !== undefined) {
    params.set(DASHBOARD_AXIS_PARAM, axisId);
  }

  params.set(DASHBOARD_PERIOD_PARAM, periodId);
  params.set(DASHBOARD_DEBT_PARAM, trendMode);
  params.set(DASHBOARD_MONTH_PARAM, month);

  return `${DASHBOARD_PATH}?${params.toString()}`;
};
