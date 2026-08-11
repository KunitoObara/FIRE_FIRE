export {};

declare global {
  /**
   * B3の取引1件(入出金明細CSVの1行に対応)。
   *
   * **保存形へ移行する途中の状態にある。** 下の任意フィールドが
   * `users/{uid}/transactions`のドキュメント(docs/transaction-import-requirements.md 3.1)で、
   * `category` / `description`はサンプルデータとB3の絞り込みが参照している旧来の形。
   *
   * 新しいフィールドを任意(`?`)にしてあるのは、必須にすると参照側が一度に全部壊れて
   * PRを分割できなくなるため(docs/development-workflow.md 5章「型の波及を切る手口」)。
   * **B3をFirestoreへ接続する[B3-1]で必須化し、旧来の2つを落とす。**
   */
  type Transaction = {
    id: string;
    /** 取引日(yyyy-MM-dd) */
    date: string;
    /**
     * 費目。費目マスタは存在せず(B4の資産分類軸とは別物)、CSVの値をそのまま使う想定のため
     * ここでは単純な文字列として扱う。保存形では`categoryMajor` / `categoryMinor`の2階層になる
     */
    category: string;
    /** 口座名。費目と同じ理由でマスタは持たず文字列として扱う */
    account: string;
    /** 収入はプラス、支出はマイナス */
    amount: number;
    /** 摘要。保存形では`content` */
    description: string;
    /** 内容(摘要)。CSVの`内容`列(200文字まで) */
    content?: string;
    /** 費目の上位。B1の費目別支出はこの粒度で集計する(6章) */
    categoryMajor?: string;
    /** 費目の下位。未設定は空文字のままにし、セレクタの選択肢にも出さない(6章) */
    categoryMinor?: string;
    /** マネーフォワード側で付けた自由記述(1,000文字まで) */
    memo?: string;
    /** 自口座間の振替。B3には表示するが収支の集計からは外す(5章) */
    isTransfer?: boolean;
    /** マネーフォワード側の`計算対象`。`false`はB3に表示しつつ集計から外す(5章) */
    isCalculationTarget?: boolean;
  };

  /** B3の期間絞り込みの選択肢(docs/screen-requirements-dashboard.md B3) */
  type TransactionPeriodId = "1m" | "3m" | "this-year" | "all";

  /** 期間絞り込みの1選択肢 */
  type TransactionPeriod = {
    id: TransactionPeriodId;
    label: string;
  };

  /**
   * 表示期間をFirestoreの範囲クエリに直したもの(`yyyy-MM-dd`)。
   * 「全期間」は境界を持たないので両方`null`になり、その条件はクエリに付けない。
   */
  type TransactionDateRange = {
    /** この日を含む */
    from: string | null;
    /** この日を含む */
    to: string | null;
  };

  /**
   * B3が表示する取引の取得結果(docs/transaction-import-requirements.md 8章)。
   *
   * 1件も取り込んでいないアカウントでは空配列になる。失敗ではないので`ok: true`で返す
   * (`AssetSnapshotsResult`と同じ扱い)。
   */
  type TransactionsFetchResult =
    | {
        ok: true;
        /** 取引日の新しい順。上限に達した場合に欠けるのは古い側だけになる */
        transactions: Transaction[];
        /**
         * `TRANSACTION_SCAN_LIMIT`件を超える取引があり、古い側を切り落としたか。
         * 打ち切ったことは画面に出す — 黙って欠けると、一覧に無いことを
         * 「取り込んでいない」と読み違える
         */
        truncated: boolean;
      }
    | { ok: false; reason: FirestoreAccessFailureReason };

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
