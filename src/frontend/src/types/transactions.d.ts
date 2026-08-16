export {};

declare global {
  /**
   * B3の取引1件。`users/{uid}/transactions`のドキュメント
   * (docs/transaction-import-requirements.md 3.1)に、ドキュメントIDを`id`として足したもの。
   *
   * サンプルデータ時代の`category` / `description`は、B3をFirestoreへ繋いだ時点で落とした。
   * 移行のあいだ任意にしてあった保存形のフィールドも、参照側(`query.ts` / `TransactionsTable`)
   * を追随させると同時に必須へ締めてある(docs/development-workflow.md 5章「型の波及を切る手口」)。
   */
  type Transaction = {
    /** ドキュメントID。マネーフォワードの`ID`列そのもの(3.2) */
    id: string;
    /** 取引日(yyyy-MM-dd) */
    date: string;
    /** 内容(摘要)。CSVの`内容`列(200文字まで) */
    content: string;
    /** 収入はプラス、支出はマイナス。CSVの符号をそのまま保つ(5章) */
    amount: number;
    /** 口座名。費目と同じくマスタは持たず文字列として扱う */
    account: string;
    /** 費目の上位。B1の費目別支出はこの粒度で集計する(6章) */
    categoryMajor: string;
    /** 費目の下位。未設定は空文字のままにし、セレクタの選択肢にも出さない(6章) */
    categoryMinor: string;
    /** マネーフォワード側で付けた自由記述(1,000文字まで) */
    memo: string;
    /** 自口座間の振替。B3には表示するが収支の集計からは外す(5章) */
    isTransfer: boolean;
    /** マネーフォワード側の`計算対象`。`false`はB3に表示しつつ集計から外す(5章) */
    isCalculationTarget: boolean;
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
    /** 費目(大項目)・中項目・口座は未選択(すべて)を空文字で表す */
    category: string;
    /**
     * 費目の中項目。大項目とは独立して効く(大項目が未選択でも中項目だけで絞れる)。
     * 選択肢の並びだけが大項目に連動する(docs/transaction-import-requirements.md 6章)
     */
    categoryMinor: string;
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
    /**
     * 費目(大項目)セレクタの選択肢。マスタが無いため取引データから動的に抽出したもの。
     * 抽出の対象は**読み込んだ期間内の取引だけ**で、選択肢のために全期間を読み直さない
     */
    categories: string[];
    /**
     * 大項目ごとの中項目。大項目を選ぶと中項目セレクタの選択肢がその配下に絞られ、
     * 大項目が未選択のときは全ての中項目を並べる(docs/transaction-import-requirements.md 6章)。
     *
     * 空の中項目はキーにも値にも入れない。マネーフォワードが空で返しているものに
     * アプリ側で名前を与えないため(同章)
     */
    categoryMinorsByMajor: Record<string, string[]>;
    /** 口座セレクタの選択肢。費目と同じ理由で取引データから動的に抽出したもの */
    accounts: string[];
  };

  /**
   * 費目・口座セレクタの1選択肢。
   *
   * **選択中の値は、その期間に1件も無くても選択肢に残す**(docs/screen-requirements-dashboard.md B3)。
   * 期間を切り替えると選択肢の集合が変わるため、URLに載っている選択値が消えることがある。
   * 黙って外すと、結果が0件なのは「本当に無い」からなのか「選択が外れた」からなのかを
   * 画面から区別できない。`available: false` はその状態を表し、ラベルに但し書きを添える。
   */
  type TransactionSelectOption = {
    value: string;
    label: string;
    /** 読み込んだ期間の取引にこの値が現れるか */
    available: boolean;
  };

  /**
   * B3の表示データの取得結果。
   *
   * `truncated`を`TransactionsData`の中に持たせないのは、これが**読み取りの状態**であって
   * 表示するデータの一部ではないため。絞り込みの解決(`resolveTransactionFilters`)や
   * セレクタは`TransactionsData`だけを見ればよい。
   */
  type TransactionsDataResult =
    | {
        ok: true;
        data: TransactionsData;
        /** 読み取りが`TRANSACTION_SCAN_LIMIT`件で打ち切られたか。画面に出す */
        truncated: boolean;
      }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /** B3の画面本体(TransactionsScreen)のProps */
  type TransactionsScreenProps = {
    /**
     * URLのクエリパラメータ一式。Server Component側で解決して渡す。
     *
     * 画面本体は取得のためにClient Componentである必要があるが、`useSearchParams`を使うと
     * Suspense境界が要る(Next.jsのuseSearchParamsドキュメント)。B1が同じ理由で
     * Server Component側からクエリを渡している
     */
    searchParams: Record<string, string | string[] | undefined>;
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
    /** 費目(大項目)の選択肢 */
    categories: string[];
    /** 大項目ごとの中項目。大項目の選択に応じて中項目セレクタの選択肢を絞るために使う */
    categoryMinorsByMajor: Record<string, string[]>;
    accounts: string[];
    filters: TransactionFilters;
  };

  /** 費目・中項目・口座のセレクタ(TransactionsFilterBar内)のProps */
  type TransactionFilterSelectProps = {
    id: string;
    label: string;
    /** 「すべて」を表すUI専用の値。Radix `Select`が空文字を許さないため種別ごとに割り当てる */
    allValue: string;
    options: TransactionSelectOption[];
    /** 選択中の値。未選択は空文字 */
    value: string;
    /** セレクタの幅(Tailwindのクラス)。並べたときに項目名の長さと釣り合わせる */
    widthClassName: string;
    onChange: (value: string) => void;
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
