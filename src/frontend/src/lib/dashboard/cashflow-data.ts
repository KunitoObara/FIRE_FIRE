import { fetchMonthlyTransactions } from "@/lib/csv-import/transaction-repository";
import { buildCashflowSummary } from "@/lib/dashboard/aggregation";

/**
 * 収支サマリ(B1)が表示するデータを、B2で取り込んだ取引から組み立てる。
 *
 * ```
 * users/{uid}/transactions   B2 CSV取込   収支サマリ(選択中の年月の1ヶ月分だけ)
 * ```
 *
 * **ダッシュボードの一括取得(`fetchDashboardData`)から分けてある。** 年月を切り替えたときに
 * 読み直すのはその月の取引だけで、資産残高・分類軸・負債・FIRE目標は引き直さない
 * (docs/screen-requirements-dashboard.md B1「年月の選択」)。混ぜたままだと、月を変えるたびに
 * 画面全体の読み取りが増える。
 *
 * 読むのは選択中の1ヶ月分だけとする(docs/transaction-import-requirements.md 8章)。取引は月に
 * 数百件のペースで積み上がるため、全件を読むと表示のたびに読み取りが増え続ける。
 *
 * 取引が0件のときは`cashflow: null`を`ok: true`で返す。**「その月に取引が無い」は失敗ではない** —
 * 月初や取り込んでいない過去の月では正常に起こる。失敗は取得そのものができなかった場合だけを指し、
 * カードは空状態と失敗を別の表示にする(同要件B1「選択した年月にデータが無いとき」)。
 */
export const fetchCashflowData = async (month: string): Promise<CashflowDataResult> => {
  const result = await fetchMonthlyTransactions(month);

  if (!result.ok) {
    return result;
  }

  /*
    集計する月は読んだ範囲と同じ値を渡す。別々に決めると、月をまたぐ瞬間や表示中に日付が
    変わった場合に「先月の取引を今月として集計する」ずれが起きうる
  */
  return { ok: true, cashflow: buildCashflowSummary(result.transactions, month) };
};
