import { USE_SAMPLE_TRANSACTIONS_DATA } from "@/constants/transactions";
import { createSampleTransactionsData } from "@/lib/transactions/sample-data";

/** 入出金明細CSVを一度も取り込んでいないアカウントの状態 */
const EMPTY_TRANSACTIONS_DATA: TransactionsData = {
  transactions: [],
  categories: [],
  accounts: [],
};

/**
 * B3が表示する取引データを取得する。
 *
 * 現時点では入出金明細CSVの取込(B2)が無くFirestoreに実データが無いため、
 * `USE_SAMPLE_TRANSACTIONS_DATA`に従ってサンプルデータか空のデータを返すだけの関数である
 * (`src/lib/dashboard/dashboard-data.ts`の`getDashboardData`と同じ位置付け)。
 * 入出金明細CSVの取込が実装された時点で、ここをFirestoreからの取得に差し替える。
 */
export const getTransactionsData = (now: Date): TransactionsData =>
  USE_SAMPLE_TRANSACTIONS_DATA ? createSampleTransactionsData(now) : EMPTY_TRANSACTIONS_DATA;
