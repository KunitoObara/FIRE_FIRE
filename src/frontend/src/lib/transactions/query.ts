/**
 * 費目・口座・キーワードで取引一覧を絞り込む。
 *
 * **期間はここで絞らない。** Firestoreから読む時点で選択中の期間の範囲クエリを掛けており
 * (`resolveTransactionDateRange`)、ここで重ねて絞ると同じ条件を2箇所で持つことになる。
 * 片方だけを直したときに、読めているのに表示から落ちる取引が出る
 * (docs/transaction-import-requirements.md 8章)。
 *
 * 費目は**大項目**で突き合わせる。キーワードは内容(摘要)に対する部分一致で、大小文字は
 * 区別しない。Firestoreの複合条件に載せられない絞り込みなので、読み込んだ範囲に対して
 * クライアント側で行う。
 */
export const filterTransactions = (
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] => {
  const keyword = filters.keyword.toLowerCase();

  return transactions.filter((transaction) => {
    if (filters.category !== "" && transaction.categoryMajor !== filters.category) {
      return false;
    }

    if (filters.account !== "" && transaction.account !== filters.account) {
      return false;
    }

    return keyword === "" || transaction.content.toLowerCase().includes(keyword);
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
