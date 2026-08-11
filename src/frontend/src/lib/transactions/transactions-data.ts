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
 * 現時点では`USE_SAMPLE_TRANSACTIONS_DATA`に従ってサンプルデータか空のデータを返すだけの
 * 関数である。**入出金明細CSVの取込(B2)はB2-3で実装済み**で`users/{uid}/transactions`に
 * 実データが入るが、ここをFirestoreからの取得に差し替えるのは[B3-1]の範囲になる
 * (B1の`src/lib/dashboard/dashboard-data.ts`が`fetchDashboardData`で行ったのと同じ差し替え)。
 */
export const getTransactionsData = (now: Date): TransactionsData =>
  USE_SAMPLE_TRANSACTIONS_DATA ? createSampleTransactionsData(now) : EMPTY_TRANSACTIONS_DATA;
