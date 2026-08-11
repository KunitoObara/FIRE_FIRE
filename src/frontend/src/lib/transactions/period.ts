import { format, parseISO, startOfDay, startOfYear, subMonths } from "date-fns";

import { STORED_DATE_FORMAT } from "@/constants/csv-import";

/**
 * 期間の始まりを決める。「直近Nヶ月」は現在からNヶ月前の同日を境界にし、その日ちょうどの
 * 取引は含める(`src/lib/dashboard/period.ts`の`filterSeriesByPeriod`と同じ考え方)。
 * 「今年」は当年1/1以降。
 *
 * **Firestoreの範囲クエリとクライアント側の絞り込みで同じ関数を使う。** 境界の決め方が
 * 2箇所に分かれると、読む範囲と絞り込む範囲がずれても気づけない。
 */
const resolvePeriodStart = (periodId: Exclude<TransactionPeriodId, "all">, now: Date): Date =>
  periodId === "this-year"
    ? startOfYear(now)
    : startOfDay(subMonths(now, periodId === "1m" ? 1 : 3));

/**
 * 表示期間をFirestoreの範囲クエリの境界に直す
 * (docs/transaction-import-requirements.md 8章)。
 *
 * B3が読むのは選択中の期間の分だけで、費目・口座・キーワードの絞り込みと並び替えは
 * 読み込んだ範囲に対してクライアント側で行う。取引は際限なく増えるデータなので、
 * 全件を読むと蓄積に比例して読み取りが増え続ける。
 *
 * 「全期間」は境界を持たないので`null`を返す。呼び出し側はその条件を付けずにクエリを組む。
 *
 * **終わりは「今日」で閉じる。** 8章が `where(date, <=, to)` を求めているため。日付が未来の
 * 取引があれば「直近1ヶ月」等には現れず「全期間」でだけ見えることになるが、マネーフォワードの
 * 入出金明細は発生済みの取引を書き出すもので、未来日付は本来現れない。
 */
export const resolveTransactionDateRange = (
  periodId: TransactionPeriodId,
  now: Date,
): TransactionDateRange =>
  periodId === "all"
    ? { from: null, to: null }
    : {
        from: format(resolvePeriodStart(periodId, now), STORED_DATE_FORMAT),
        to: format(now, STORED_DATE_FORMAT),
      };

/**
 * 取引一覧を表示期間で絞り込む(B3の期間絞り込み)。
 *
 * サンプルデータを表示している間の絞り込みで、Firestoreから読むようになれば範囲クエリ
 * (`resolveTransactionDateRange`)が同じ役目を担う。境界の決め方は`resolvePeriodStart`に
 * 一本化してあるので、両者の結果は一致する。
 */
export const filterTransactionsByPeriod = (
  transactions: Transaction[],
  periodId: TransactionPeriodId,
  now: Date,
): Transaction[] => {
  if (periodId === "all") {
    return transactions;
  }

  const since = resolvePeriodStart(periodId, now);

  return transactions.filter(
    (transaction) => parseISO(transaction.date).getTime() >= since.getTime(),
  );
};
