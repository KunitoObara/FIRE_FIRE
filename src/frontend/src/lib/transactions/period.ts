import { endOfMonth, format, startOfDay, startOfMonth, startOfYear, subMonths } from "date-fns";

import { STORED_DATE_FORMAT } from "@/constants/csv-import";
import { fromMonthKey } from "@/lib/dashboard/month";

/**
 * 期間の始まりを決める。「直近Nヶ月」は現在からNヶ月前の同日を境界にし、その日ちょうどの
 * 取引は含める(`src/lib/dashboard/period.ts`の`filterSeriesByPeriod`と同じ考え方)。
 * 「今年」は当年1/1以降。
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
 * 指定した年月(`yyyy-MM`)の範囲を出す(docs/transaction-import-requirements.md 8章
 * 「B1の収支サマリは選択中の年月の1ヶ月だけを読む」)。
 *
 * **月初から月末までを丸ごと含める。** その月の収支を出すカードなので、当月を選んでいる場合は
 * 今日より後の日付が付いた取引もその月のものとして数える。B3の「直近1ヶ月」等が今日で閉じるのは
 * 「直近」が今を終点とする言葉だからで、こちらは月そのものを指している。
 *
 * **受け取るのは`Date`ではなく年月。** 対象の月は画面上で選べる(既定は当月)ので、`Date`で
 * 受けると呼び出し側が「当月」しか渡せない形が残る。当月を指す値は`toMonthKey(new Date())`で作る
 * (docs/screen-requirements-dashboard.md B1「年月の選択」)。
 */
export const resolveTransactionMonthRange = (month: string): TransactionDateRange => {
  const firstDay = fromMonthKey(month);

  return {
    from: format(startOfMonth(firstDay), STORED_DATE_FORMAT),
    to: format(endOfMonth(firstDay), STORED_DATE_FORMAT),
  };
};
