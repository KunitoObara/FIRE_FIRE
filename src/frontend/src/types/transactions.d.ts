export {};

declare global {
  /** B3の取引1件(入出金明細CSVの1行に対応) */
  type Transaction = {
    id: string;
    /** 取引日(yyyy-MM-dd) */
    date: string;
    /**
     * 費目。費目マスタは存在せず(B4の資産分類軸とは別物)、CSVの値をそのまま使う想定のため
     * ここでは単純な文字列として扱う
     */
    category: string;
    /** 口座名。費目と同じ理由でマスタは持たず文字列として扱う */
    account: string;
    /** 収入はプラス、支出はマイナス */
    amount: number;
    /** 摘要 */
    description: string;
  };

  /** B3の期間絞り込みの選択肢(docs/screen-requirements-dashboard.md B3) */
  type TransactionPeriodId = "1m" | "3m" | "this-year" | "all";

  /** 期間絞り込みの1選択肢 */
  type TransactionPeriod = {
    id: TransactionPeriodId;
    label: string;
  };

  /** 並び替え対象の列。要件上「並び替え(日付/金額)」の2列のみ対応する */
  type TransactionSortKey = "date" | "amount";

  type TransactionSortDirection = "asc" | "desc";

  /** URLから解決した絞り込み・並び替え・ページの状態 */
  type TransactionFilters = {
    periodId: TransactionPeriodId;
    /** 費目・口座は未選択(すべて)を空文字で表す */
    category: string;
    account: string;
    keyword: string;
    sortKey: TransactionSortKey;
    sortDirection: TransactionSortDirection;
    /** 1始まり */
    page: number;
  };

  /** B3が表示するデータ一式 */
  type TransactionsData = {
    transactions: Transaction[];
    /** 費目セレクタの選択肢。マスタが無いため取引データから動的に抽出したもの */
    categories: string[];
    /** 口座セレクタの選択肢。費目と同じ理由で取引データから動的に抽出したもの */
    accounts: string[];
  };

  /** 絞り込み・並び替え・ページングを適用した結果 */
  type TransactionsPageResult = {
    rows: Transaction[];
    /** 絞り込み後・ページング前の件数 */
    totalCount: number;
    totalPages: number;
    /** 範囲外のページ指定を丸めた後のページ番号 */
    page: number;
  };

  /** 絞り込みバー(TransactionsFilterBar)のProps */
  type TransactionsFilterBarProps = {
    categories: string[];
    accounts: string[];
    filters: TransactionFilters;
  };

  /** 取引一覧テーブル(TransactionsTable)のProps */
  type TransactionsTableProps = {
    rows: Transaction[];
    filters: TransactionFilters;
    totalCount: number;
    totalPages: number;
    pageSize: number;
  };

  /** 並び替え可能な列見出し(TransactionsTable内)のProps */
  type TransactionSortableColumnHeaderProps = {
    label: string;
    column: TransactionSortKey;
    filters: TransactionFilters;
  };
}
