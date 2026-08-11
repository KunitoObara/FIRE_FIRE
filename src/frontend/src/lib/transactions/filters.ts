import { TRANSACTIONS_PATH } from "@/constants/routes";
import {
  DEFAULT_TRANSACTION_PERIOD_ID,
  DEFAULT_TRANSACTION_SORT_DIRECTION,
  DEFAULT_TRANSACTION_SORT_KEY,
  TRANSACTION_ACCOUNT_PARAM,
  TRANSACTION_CATEGORY_PARAM,
  TRANSACTION_KEYWORD_PARAM,
  TRANSACTION_PAGE_PARAM,
  TRANSACTION_PERIODS,
  TRANSACTION_PERIOD_PARAM,
  TRANSACTION_SORT_DIRECTION_PARAM,
  TRANSACTION_SORT_PARAM,
} from "@/constants/transactions";
import { firstQueryValue } from "@/lib/query-params";

type TransactionSearchParamValue = string | string[] | undefined;
type TransactionSearchParams = Record<string, TransactionSearchParamValue>;

/** URLの`period`から表示期間を決める。未指定・不正な値は既定値に落とす */
export const resolveTransactionPeriodId = (
  value: TransactionSearchParamValue,
): TransactionPeriodId => {
  const matched = TRANSACTION_PERIODS.find((period) => period.id === firstQueryValue(value));
  return matched?.id ?? DEFAULT_TRANSACTION_PERIOD_ID;
};

/**
 * URLの`category`/`account`から絞り込み値を決める。
 *
 * 費目・口座はマスタが無く取引データから動的に抽出するため、既存データに無い値(手で書き換えた
 * URL等)は「すべて」(空文字)に落とす。
 */
export const resolveTransactionOption = (
  value: TransactionSearchParamValue,
  options: string[],
): string => {
  const raw = firstQueryValue(value);
  return raw !== null && options.includes(raw) ? raw : "";
};

/** URLの`q`からキーワード検索の値を決める。前後の空白は無視する */
export const resolveTransactionKeyword = (value: TransactionSearchParamValue): string =>
  firstQueryValue(value)?.trim() ?? "";

/** URLの`sort`から並び替え列を決める。未指定・不正な値は既定値(日付)に落とす */
export const resolveTransactionSortKey = (
  value: TransactionSearchParamValue,
): TransactionSortKey =>
  firstQueryValue(value) === "amount" ? "amount" : DEFAULT_TRANSACTION_SORT_KEY;

/** URLの`dir`から並び替え方向を決める。未指定・不正な値は既定値(降順)に落とす */
export const resolveTransactionSortDirection = (
  value: TransactionSearchParamValue,
): TransactionSortDirection =>
  firstQueryValue(value) === "asc" ? "asc" : DEFAULT_TRANSACTION_SORT_DIRECTION;

/** URLの`page`からページ番号を決める。1未満・数値でない値は1に落とす */
export const resolveTransactionPage = (value: TransactionSearchParamValue): number => {
  const raw = firstQueryValue(value);
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
};

/** URLのクエリパラメータ一式から、B3の絞り込み・並び替え・ページの状態をまとめて決める */
export const resolveTransactionFilters = (
  searchParams: TransactionSearchParams,
  data: TransactionsData,
): TransactionFilters => ({
  periodId: resolveTransactionPeriodId(searchParams[TRANSACTION_PERIOD_PARAM]),
  category: resolveTransactionOption(searchParams[TRANSACTION_CATEGORY_PARAM], data.categories),
  account: resolveTransactionOption(searchParams[TRANSACTION_ACCOUNT_PARAM], data.accounts),
  keyword: resolveTransactionKeyword(searchParams[TRANSACTION_KEYWORD_PARAM]),
  sortKey: resolveTransactionSortKey(searchParams[TRANSACTION_SORT_PARAM]),
  sortDirection: resolveTransactionSortDirection(searchParams[TRANSACTION_SORT_DIRECTION_PARAM]),
  page: resolveTransactionPage(searchParams[TRANSACTION_PAGE_PARAM]),
});

/** 絞り込み・並び替え・ページの状態を反映したB3のURLを組み立てる */
export const buildTransactionsHref = (filters: TransactionFilters): string => {
  const params = new URLSearchParams();

  params.set(TRANSACTION_PERIOD_PARAM, filters.periodId);

  if (filters.category) {
    params.set(TRANSACTION_CATEGORY_PARAM, filters.category);
  }

  if (filters.account) {
    params.set(TRANSACTION_ACCOUNT_PARAM, filters.account);
  }

  if (filters.keyword) {
    params.set(TRANSACTION_KEYWORD_PARAM, filters.keyword);
  }

  params.set(TRANSACTION_SORT_PARAM, filters.sortKey);
  params.set(TRANSACTION_SORT_DIRECTION_PARAM, filters.sortDirection);

  if (filters.page !== 1) {
    params.set(TRANSACTION_PAGE_PARAM, String(filters.page));
  }

  const query = params.toString();
  return query ? `${TRANSACTIONS_PATH}?${query}` : TRANSACTIONS_PATH;
};

/**
 * `TransactionsFilterBar`に渡す`key`を組み立てる。
 *
 * このフォームは編集中のドラフト値を`useState`の初期値としてのみ`filters`から受け取り、以後は
 * 自分の送信でしか更新しない。ブラウザの戻る/進む等、フォームの送信を経由せず`filters`(URL)が
 * 変わった場合にドラフトを追従させるため、この関数が返す値をkeyに渡してコンポーネントごと
 * 再マウントさせる(Reactの「keyでstateをリセットする」パターン。`useEffect`でstateを
 * 追従させる方式は`react-hooks/set-state-in-effect`に抵触するため採らない)。
 *
 * 並び替え・ページはこのフォームが管理しない値なので含めない。含めると、並び替えヘッダ
 * (`buildTransactionSortHref`)やページングだけの遷移でも毎回フォームが再マウントされ、
 * 無駄な描画が増える。
 */
export const buildTransactionsFilterBarKey = (filters: TransactionFilters): string =>
  [filters.periodId, filters.category, filters.account, filters.keyword].join("|");

/**
 * 並び替え列の見出しリンクを組み立てる。
 * 選択中の列を再度押すと昇順/降順を切り替え、別の列を押すと降順から始める。
 * 並び替えを変えると表示されるページの中身が変わるため、ページは1に戻す。
 */
export const buildTransactionSortHref = (
  column: TransactionSortKey,
  filters: TransactionFilters,
): string => {
  const nextDirection: TransactionSortDirection =
    filters.sortKey === column && filters.sortDirection === "desc" ? "asc" : "desc";

  return buildTransactionsHref({
    ...filters,
    sortKey: column,
    sortDirection: nextDirection,
    page: 1,
  });
};
