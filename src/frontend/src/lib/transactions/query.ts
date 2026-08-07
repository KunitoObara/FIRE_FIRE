import { filterTransactionsByPeriod } from "@/lib/transactions/period";

/**
 * 費目・口座・キーワードで取引一覧を絞り込む。期間の絞り込みは`filterTransactionsByPeriod`が
 * 別途担う(呼び出し側で先に適用する)。
 */
export const filterTransactions = (
  transactions: Transaction[],
  filters: TransactionFilters,
  now: Date,
): Transaction[] => {
  const byPeriod = filterTransactionsByPeriod(transactions, filters.periodId, now);
  const keyword = filters.keyword.toLowerCase();

  return byPeriod.filter((transaction) => {
    if (filters.category !== "" && transaction.category !== filters.category) {
      return false;
    }

    if (filters.account !== "" && transaction.account !== filters.account) {
      return false;
    }

    return keyword === "" || transaction.description.toLowerCase().includes(keyword);
  });
};

const compareByDate = (a: Transaction, b: Transaction): number => {
  if (a.date < b.date) {
    return -1;
  }

  if (a.date > b.date) {
    return 1;
  }

  return 0;
};

const compareByAmount = (a: Transaction, b: Transaction): number => a.amount - b.amount;

/** 日付または金額で並び替える。要件上この2列のみが対象(docs/screen-requirements-dashboard.md B3) */
export const sortTransactions = (
  transactions: Transaction[],
  sortKey: TransactionSortKey,
  sortDirection: TransactionSortDirection,
): Transaction[] => {
  const sign = sortDirection === "asc" ? 1 : -1;
  const compare = sortKey === "date" ? compareByDate : compareByAmount;

  return [...transactions].sort((a, b) => compare(a, b) * sign);
};

/** ページングを適用する。範囲外のページ指定(削除・絞り込みで件数が減った等)は末尾ページに丸める */
export const paginateTransactions = (
  transactions: Transaction[],
  page: number,
  pageSize: number,
): TransactionsPageResult => {
  const totalCount = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * pageSize;

  return {
    rows: transactions.slice(start, start + pageSize),
    totalCount,
    totalPages,
    page: clampedPage,
  };
};
