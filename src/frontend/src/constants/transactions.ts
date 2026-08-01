/** B3 収支明細一覧画面で使う定数 */

import { CSV_IMPORT_PATH } from "@/constants/routes";

/**
 * サンプルデータを表示するかどうか。
 *
 * 入出金明細CSVの取込(B2)がまだ無く、Firestoreに取引データが存在しないため、画面の見た目を
 * 確認できるようサンプルデータを流し込んでいる(`src/constants/dashboard.ts`の
 * `USE_SAMPLE_DASHBOARD_DATA`と同じ考え方)。入出金明細CSVの取込が実装されたら`false`にして
 * `src/lib/transactions/sample-data.ts`ごと外す。
 *
 * `false`にすると一覧が空状態(CSV取込への導線)になる。
 */
export const USE_SAMPLE_TRANSACTIONS_DATA = true;

/** サンプルデータ表示中であることを画面に明示する文言。実データと取り違えないためのもの */
export const SAMPLE_TRANSACTIONS_DATA_NOTICE =
  "表示中の取引はすべてサンプルです。入出金明細CSVの取込(B2)実装後に実データへ切り替わります。";

/** 期間絞り込みの選択肢(docs/screen-requirements-dashboard.md B3) */
export const TRANSACTION_PERIODS: TransactionPeriod[] = [
  { id: "1m", label: "直近1ヶ月" },
  { id: "3m", label: "直近3ヶ月" },
  { id: "this-year", label: "今年" },
  { id: "all", label: "全期間" },
];

/** 期間絞り込みの既定値 */
export const DEFAULT_TRANSACTION_PERIOD_ID: TransactionPeriodId = "1m";

/** 並び替えの既定値。初期表示は日付の新しい順 */
export const DEFAULT_TRANSACTION_SORT_KEY: TransactionSortKey = "date";
export const DEFAULT_TRANSACTION_SORT_DIRECTION: TransactionSortDirection = "desc";

/**
 * 「すべて」を表す費目・口座セレクタの選択値。
 * 未選択は内部的に空文字(`TransactionFilters.category`/`account`)で表すが、Radix
 * `Select`のitem valueには空文字を使えないため、UI表示専用のダミー値を割り当てる。
 */
export const ALL_TRANSACTION_CATEGORIES_VALUE = "__all-categories__";
export const ALL_TRANSACTION_ACCOUNTS_VALUE = "__all-accounts__";

/** 1ページあたりの表示件数 */
export const TRANSACTIONS_PAGE_SIZE = 20;

/**
 * 絞り込み・並び替え・ページの状態をURLに載せるときのクエリパラメータ名。
 * リンク共有・ブラウザの戻る/進むで同じ表示を再現するため、これらはURLに持たせる
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
export const TRANSACTION_PERIOD_PARAM = "period";
export const TRANSACTION_CATEGORY_PARAM = "category";
export const TRANSACTION_ACCOUNT_PARAM = "account";
export const TRANSACTION_KEYWORD_PARAM = "q";
export const TRANSACTION_SORT_PARAM = "sort";
export const TRANSACTION_SORT_DIRECTION_PARAM = "dir";
export const TRANSACTION_PAGE_PARAM = "page";

/** 「CSVを取り込む」ボタンの導線 */
export const TRANSACTIONS_CSV_IMPORT_LINK = {
  label: "CSVを取り込む",
  href: CSV_IMPORT_PATH,
} as const;

/** 取引データが1件も無いときの案内 */
export const NO_TRANSACTIONS_EMPTY_STATE = {
  message: "入出金明細のデータがまだありません。CSVを取り込むと取引が表示されます。",
  action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
} as const;

/** 絞り込み条件に一致する取引が無いときの表示 */
export const NO_MATCHING_TRANSACTIONS_LABEL = "条件に一致する取引がありません。";
