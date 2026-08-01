import { parseISO, startOfDay, startOfYear, subMonths } from "date-fns";

/**
 * 取引一覧を表示期間で絞り込む(B3の期間絞り込み)。
 *
 * 「直近Nヶ月」は現在からNヶ月前の同日を境界にし、その日ちょうどの取引は含める
 * (`src/lib/dashboard/period.ts`の`filterSeriesByPeriod`と同じ考え方)。「今年」は当年1/1以降、
 * 「全期間」は絞り込まない。
 */
export const filterTransactionsByPeriod = (
  transactions: Transaction[],
  periodId: TransactionPeriodId,
  now: Date,
): Transaction[] => {
  if (periodId === "all") {
    return transactions;
  }

  const since =
    periodId === "this-year"
      ? startOfYear(now)
      : startOfDay(subMonths(now, periodId === "1m" ? 1 : 3));

  return transactions.filter(
    (transaction) => parseISO(transaction.date).getTime() >= since.getTime(),
  );
};
