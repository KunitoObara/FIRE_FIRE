import { subMonths } from "date-fns";

import {
  buildMonthlyContributionEmptyNotice,
  buildMonthlyContributionFailureNotice,
  buildMonthlyContributionPrefillNotice,
} from "@/constants/fire-goal";
import { formatMonthLabel, toMonthKey } from "@/lib/dashboard/month";

/**
 * 毎月の積立額(B8)の初期値を前月の収支から解決する
 * (docs/screen-requirements-fire-goal.md B8「毎月の積立額」)。
 *
 * 要件定義書 4.6 の「現在のペースに基づく」を、手入力のまま満たすための出発点。提示するのは
 * 画面を開いた時点の初期値だけで、保存後に追従して変わることはしない。
 */

/**
 * 初期値の出所にする年月(`yyyy-MM`)を出す。**当月ではなく前月**(要件B8)。
 *
 * 当月は月初だと数日分しか無く、その月の収支として意味を成さない。前月なら1ヶ月分が揃っている。
 *
 * 基準の`Date`を受け取るのは、月をまたぐ瞬間に「読んだ月」と「注記に出す月」がずれないように
 * するため(B1が`now`を1か所で作って配っているのと同じ理由)。
 */
export const resolveContributionSourceMonth = (now: Date): string => toMonthKey(subMonths(now, 1));

/**
 * 前月の収支サマリから初期値と注記を組み立てる。
 *
 * **収支が取れた場合だけ金額を入れる。** 取引が0件のときに0円を提示すると「収支がちょうど0
 * だった」と読めてしまうため、空欄のまま提示できなかった理由を添える(要件B8)。取得そのものに
 * 失敗した場合も空欄にするが、原因が違う(取り込めば埋まるのか、読み直せば直るのか)ので
 * 文言を分ける。いずれの場合も目標の設定自体は続けられる。
 *
 * 収支の求め方はB1の収支サマリと同じ`income - expense`で、振替・計算対象外の行は
 * `buildCashflowSummary`が既に除いている。同じ月について画面ごとに違う収支が出ないよう、
 * ここで独自に集計し直さない。
 */
export const resolveMonthlyContributionPrefill = (
  result: CashflowDataResult | undefined,
  month: string,
): MonthlyContributionPrefill => {
  const monthLabel = formatMonthLabel(month);

  // 取得前(`undefined`)は失敗ではないので注記も出さない。呼び出し側は取得を待ってから呼ぶ
  if (result === undefined) {
    return { amount: null, notice: null };
  }

  if (!result.ok) {
    return { amount: null, notice: buildMonthlyContributionFailureNotice(monthLabel) };
  }

  if (result.cashflow === null) {
    return { amount: null, notice: buildMonthlyContributionEmptyNotice(monthLabel) };
  }

  return {
    amount: result.cashflow.income - result.cashflow.expense,
    notice: buildMonthlyContributionPrefillNotice(monthLabel),
  };
};
