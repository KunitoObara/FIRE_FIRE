import { TRANSACTIONS_PATH } from "@/constants/routes";
import {
  ALL_TRANSACTION_ACCOUNTS_VALUE,
  ALL_TRANSACTION_CATEGORIES_VALUE,
  ALL_TRANSACTION_CATEGORY_MINORS_VALUE,
  buildUnavailableOptionLabel,
  DEFAULT_TRANSACTION_PERIOD_ID,
  DEFAULT_TRANSACTION_SORT_DIRECTION,
  DEFAULT_TRANSACTION_SORT_KEY,
  DEFAULT_TRANSACTIONS_PAGE_SIZE,
  TRANSACTION_ACCOUNT_PARAM,
  TRANSACTION_CATEGORY_MINOR_PARAM,
  TRANSACTION_CATEGORY_PARAM,
  TRANSACTION_KEYWORD_PARAM,
  TRANSACTION_PAGE_PARAM,
  TRANSACTION_PAGE_SIZE_PARAM,
  TRANSACTION_PERIODS,
  TRANSACTION_PERIOD_PARAM,
  TRANSACTION_SORT_DIRECTION_PARAM,
  TRANSACTION_SORT_PARAM,
  TRANSACTIONS_PAGE_SIZE_OPTIONS,
} from "@/constants/transactions";
import { firstQueryValue } from "@/lib/query-params";

type TransactionSearchParamValue = string | string[] | undefined;
type TransactionSearchParams = Record<string, TransactionSearchParamValue>;

/** セレクタの「すべて」に割り当てたUI専用の値。URLに現れたら未選択として扱う */
const UI_ONLY_SELECT_VALUES = [
  ALL_TRANSACTION_CATEGORIES_VALUE,
  ALL_TRANSACTION_CATEGORY_MINORS_VALUE,
  ALL_TRANSACTION_ACCOUNTS_VALUE,
];

/** URLの`period`から表示期間を決める。未指定・不正な値は既定値に落とす */
export const resolveTransactionPeriodId = (
  value: TransactionSearchParamValue,
): TransactionPeriodId => {
  const matched = TRANSACTION_PERIODS.find((period) => period.id === firstQueryValue(value));
  return matched?.id ?? DEFAULT_TRANSACTION_PERIOD_ID;
};

/**
 * URLの`category`/`subcategory`/`account`から絞り込み値を決める。
 *
 * **読み込んだ期間に無い値でもそのまま採る。** 費目・口座はマスタが無く、選択肢は期間内の
 * 取引から作るため、期間を切り替えると選択肢の集合が変わる。そこで空文字へ落とすと、結果が
 * 0件なのは「本当に無い」からなのか「選択が外れた」からなのかを画面から区別できない
 * (docs/screen-requirements-dashboard.md B3)。選択肢に無い値は
 * `buildTransactionSelectOptions`が但し書き付きで選択肢に残す。
 *
 * 前後の空白は落とす。見えない差で「同じつもりの選択」が別物になるのを避けるため(6章)。
 */
export const resolveTransactionOption = (value: TransactionSearchParamValue): string => {
  const raw = firstQueryValue(value)?.trim() ?? "";

  /*
    「すべて」を表すダミー値がURLに載っていたら未選択として扱う。これはRadix `Select`が
    item valueに空文字を許さないための**UI専用の値**で、本来URLには現れない。手で書き換えた
    URL等でそのまま採ると、セレクタは「すべて」を指したまま一覧だけがその文字列で絞られ、
    画面の表示と絞り込みの結果が食い違う(同じ値の選択肢が2つ並ぶことにもなる)。
  */
  return UI_ONLY_SELECT_VALUES.some((uiOnlyValue) => uiOnlyValue === raw) ? "" : raw;
};

/**
 * セレクタに並べる選択肢を組み立てる。
 *
 * 選択中の値が読み込んだ期間に無ければ、末尾に但し書き付きで足す。**消さない** — 上記のとおり
 * 0件の理由を画面から区別できなくなるため。
 */
export const buildTransactionSelectOptions = (
  options: string[],
  selected: string,
): TransactionSelectOption[] => {
  const available = options.map((option) => ({
    value: option,
    label: option,
    available: true,
  }));

  if (!selected || options.includes(selected)) {
    return available;
  }

  return [
    ...available,
    { value: selected, label: buildUnavailableOptionLabel(selected), available: false },
  ];
};

/**
 * 中項目セレクタに並べる中項目を決める。
 *
 * 大項目を選ぶとその配下に絞られ、大項目が未選択のときは全ての中項目を並べる
 * (docs/transaction-import-requirements.md 6章)。同じ名前の中項目が複数の大項目にあっても
 * 1つにまとめる — 中項目だけで絞ったときは大項目をまたいで一致させるため。
 */
export const resolveCategoryMinorOptions = (
  categoryMinorsByMajor: Record<string, string[]>,
  category: string,
): string[] => {
  if (category) {
    return categoryMinorsByMajor[category] ?? [];
  }

  return [...new Set(Object.values(categoryMinorsByMajor).flat())].sort((left, right) =>
    left.localeCompare(right, "ja"),
  );
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

/**
 * URLの`size`から1ページあたりの表示件数を決める。選択肢に無い値は既定の20件に落とす。
 *
 * **選択肢との一致で判定し、範囲や整数性では判定しない。** `page`と違って任意の数を許すと、
 * 手で書き換えたURLで9,999件を1ページに並べられることになり、読み込んだ範囲の全件を
 * 一度に描画してしまう。選択肢を増やすときは`TRANSACTIONS_PAGE_SIZE_OPTIONS`だけを直す。
 */
export const resolveTransactionPageSize = (value: TransactionSearchParamValue): number => {
  const parsed = Number(firstQueryValue(value));
  const matched = TRANSACTIONS_PAGE_SIZE_OPTIONS.find((option) => option === parsed);
  return matched ?? DEFAULT_TRANSACTIONS_PAGE_SIZE;
};

/**
 * URLのクエリパラメータ一式から、B3の絞り込み・並び替え・ページの状態をまとめて決める。
 *
 * 取得したデータを引数に取らない。選択肢に無い値も残す方針にしたため、突き合わせる相手が
 * 要らなくなった(`resolveTransactionOption`)。
 */
export const resolveTransactionFilters = (
  searchParams: TransactionSearchParams,
): TransactionFilters => ({
  periodId: resolveTransactionPeriodId(searchParams[TRANSACTION_PERIOD_PARAM]),
  category: resolveTransactionOption(searchParams[TRANSACTION_CATEGORY_PARAM]),
  categoryMinor: resolveTransactionOption(searchParams[TRANSACTION_CATEGORY_MINOR_PARAM]),
  account: resolveTransactionOption(searchParams[TRANSACTION_ACCOUNT_PARAM]),
  keyword: resolveTransactionKeyword(searchParams[TRANSACTION_KEYWORD_PARAM]),
  sortKey: resolveTransactionSortKey(searchParams[TRANSACTION_SORT_PARAM]),
  sortDirection: resolveTransactionSortDirection(searchParams[TRANSACTION_SORT_DIRECTION_PARAM]),
  page: resolveTransactionPage(searchParams[TRANSACTION_PAGE_PARAM]),
  pageSize: resolveTransactionPageSize(searchParams[TRANSACTION_PAGE_SIZE_PARAM]),
});

/** 絞り込み・並び替え・ページの状態を反映したB3のURLを組み立てる */
export const buildTransactionsHref = (filters: TransactionFilters): string => {
  const params = new URLSearchParams();

  params.set(TRANSACTION_PERIOD_PARAM, filters.periodId);

  if (filters.category) {
    params.set(TRANSACTION_CATEGORY_PARAM, filters.category);
  }

  if (filters.categoryMinor) {
    params.set(TRANSACTION_CATEGORY_MINOR_PARAM, filters.categoryMinor);
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

  // 既定の20件はURLに出さない。`page`が1のときに載せないのと同じ扱い
  if (filters.pageSize !== DEFAULT_TRANSACTIONS_PAGE_SIZE) {
    params.set(TRANSACTION_PAGE_SIZE_PARAM, String(filters.pageSize));
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
  [
    filters.periodId,
    filters.category,
    filters.categoryMinor,
    filters.account,
    filters.keyword,
  ].join("|");

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

/**
 * 表示件数を変えたときの遷移先URLを組み立てる。
 *
 * **ページは1に戻す。** 20件で3ページ目を見ている状態で100件へ広げると、同じ3ページ目は
 * 201〜300件目を指すことになり、いま見ていた行が画面から消える。絞り込み条件を変えたときに
 * `page: 1`へ戻す既存の挙動(`TransactionsFilterBar`)と揃える。
 */
export const buildTransactionsPageSizeHref = (
  pageSize: number,
  filters: TransactionFilters,
): string => buildTransactionsHref({ ...filters, pageSize, page: 1 });
