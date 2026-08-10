import type { TRANSACTION_CSV_COLUMNS } from "@/constants/transactions-import";

declare global {
  /** B2の取込種別タブ(docs/screen-requirements-dashboard.md B2) */
  type CsvImportTypeId = "asset-balance" | "transaction";

  /** 取込種別タブの1選択肢 */
  type CsvImportType = {
    id: CsvImportTypeId;
    label: string;
    /** マネーフォワードのどのエクスポートを指すかの補足 */
    description: string;
    /** この種別の取込が実装済みかどうか。未実装の種別はタブに案内だけを出す */
    implemented: boolean;
  };

  /**
   * 資産残高推移CSVの1行分。
   *
   * マネーフォワードの「資産推移」エクスポートは日付と資産種別の横持ちで、種別の列は保有状況に
   * よって増減する。列名をコード側で固定できないため、種別ごとの金額はマップで持つ
   * (docs/fire-asset-management-requirements.md 4.3の拡張性要件)。
   */
  type AssetBalanceRow = {
    /** 集計日(`yyyy-MM-dd`)。FirestoreのドキュメントIDにもこれを使う */
    date: string;
    /** CSVの「合計（円）」列の値。各種別の合算はCSV側の値をそのまま採用する */
    total: number;
    /** 資産種別名をキーにした金額。キーは「（円）」を落とした列名 */
    byType: Record<string, number>;
  };

  /**
   * Firestoreに保存された資産残高の1日分(`users/{uid}/assetSnapshots/{date}`)。
   *
   * 中身は`AssetBalanceRow`と同じだが、CSVの1行(取込前)と保存済みの1日分(取込後)は
   * 出所が違う。B1が読むのは後者だけなので、型を分けて取り違えを防ぐ。
   */
  type AssetSnapshot = {
    /** 集計日(`yyyy-MM-dd`)。ドキュメントIDと同じ値 */
    date: string;
    /** CSVの「合計（円）」列の値 */
    total: number;
    /** 資産種別名をキーにした金額 */
    byType: Record<string, number>;
  };

  /**
   * 資産残高の取得結果(B1の資産推移グラフ・分類別内訳)。
   *
   * CSVを一度も取り込んでいないアカウントでは1件も無いため、失敗ではなく空配列を返す。
   */
  type AssetSnapshotsResult =
    { ok: true; snapshots: AssetSnapshot[] } | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * 直近CSV取込日時の取得結果(B1の表示項目)。
   * 未取込は失敗ではなく`lastImportedAt: null`で返す。
   */
  type LastImportedAtResult =
    | { ok: true; lastImportedAt: string | null }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /** パースに成功した資産残高推移CSVの中身 */
  type AssetBalanceParsed = {
    /** CSVから検出した資産種別名。列の並び順を保つ(合計列は含まない) */
    assetTypes: string[];
    /** 日付の昇順に並べ替えた行 */
    rows: AssetBalanceRow[];
    /** 期間の開始日(`yyyy-MM-dd`) */
    periodFrom: string;
    /** 期間の終了日(`yyyy-MM-dd`) */
    periodTo: string;
  };

  /**
   * パースに失敗した理由。
   * 画面には`CSV_PARSE_FAILURE_MESSAGES`で対応する文言を出す。
   */
  type CsvParseFailureReason =
    | "too-large"
    | "empty-file"
    | "missing-column"
    | "duplicate-column"
    | "unnamed-column"
    | "no-data-rows"
    | "too-many-rows"
    | "invalid-date"
    | "invalid-amount"
    | "duplicate-date"
    | "unreadable";

  /** パース結果。失敗時は理由と、原因の行など補足できる情報を返す */
  type AssetBalanceParseResult =
    | { ok: true; parsed: AssetBalanceParsed }
    | { ok: false; reason: CsvParseFailureReason; detail?: string };

  /**
   * 入出金明細CSVの列を指すキー(`TRANSACTION_CSV_COLUMNS`のキー)。
   *
   * 列名の一覧そのものから導く。列を増減したときに、キーを取り違えた参照が
   * コンパイル時に落ちるようにするため(`OPTIONAL_TRANSACTION_CSV_COLUMN_KEYS`)。
   */
  type TransactionCsvColumnKey = keyof typeof TRANSACTION_CSV_COLUMNS;

  /**
   * 入出金明細CSVの1行分(docs/transaction-import-requirements.md 2.1・3.1)。
   *
   * 取込前のCSVの1行を表す型で、Firestoreに保存済みの取引(`Transaction`)とは分けてある。
   * `AssetBalanceRow`と`AssetSnapshot`を分けているのと同じ理由で、出所が違うものを
   * 同じ型で扱うと取り違えるため。保存時に`importedAt`が足される。
   */
  type TransactionCsvRow = {
    /** マネーフォワードの`ID`列。FirestoreのドキュメントIDにそのまま使う(3.2) */
    id: string;
    /** 取引日(`yyyy-MM-dd`) */
    date: string;
    /** 内容(摘要) */
    content: string;
    /** 収入がプラス、支出がマイナス。CSVの符号をそのまま保つ(5章) */
    amount: number;
    /** 保有金融機関 */
    account: string;
    /** 費目の上位(例: 食費) */
    categoryMajor: string;
    /** 費目の下位(例: 外食)。未設定は空文字のまま扱い、アプリ側で名前を与えない(6章) */
    categoryMinor: string;
    /** マネーフォワード側で付けた自由記述。未設定・列が無い場合は空文字 */
    memo: string;
    /** `振替`列が`1`。自口座間の移動で、収支の集計からは外す(5章) */
    isTransfer: boolean;
    /** `計算対象`列が`1`。`false`の行も保存はするが収支の集計からは外す(5章) */
    isCalculationTarget: boolean;
  };

  /** パースに成功した入出金明細CSVの中身 */
  type TransactionCsvParsed = {
    /**
     * CSVに現れた順の行。マネーフォワードのエクスポートは新しい日付が先頭で、
     * 並べ替えない。取引は同じ日に何件でも並ぶため日付の昇順に直しても順序が一意に
     * 定まらず、プレビューの「先頭N件」も画面で見た並びと一致しなくなる
     */
    rows: TransactionCsvRow[];
    /** 最も古い取引日(`yyyy-MM-dd`) */
    periodFrom: string;
    /** 最も新しい取引日(`yyyy-MM-dd`) */
    periodTo: string;
  };

  /**
   * 入出金明細CSVのパースに失敗した理由
   * (docs/transaction-import-requirements.md 2.3)。
   *
   * 資産残高推移と共通の理由から2つを外し、入出金明細固有の4つを足したもの。
   *
   * - `duplicate-date` — **同じ日付に複数の取引があるのは正常**で、1日1行の資産残高推移とは
   *   前提が逆になる
   * - `unnamed-column` — 知らない列は無視する(2.1)ため、名前で引けない列は失敗にしない
   */
  type TransactionCsvParseFailureReason =
    | Exclude<CsvParseFailureReason, "duplicate-date" | "unnamed-column">
    /** `ID`列の値がFirestoreのドキュメントIDとして使えない(3.2) */
    | "invalid-id"
    /** 同一ファイル内に同じ`ID`の行が複数ある */
    | "duplicate-id"
    /** `計算対象` / `振替` が`0` / `1`以外 */
    | "invalid-flag"
    /** 文字列の列が3.1の上限文字数を超えている */
    | "too-long";

  /** 入出金明細CSVのパース結果。失敗時は理由と、原因の行など補足できる情報を返す */
  type TransactionCsvParseResult =
    | { ok: true; parsed: TransactionCsvParsed }
    | { ok: false; reason: TransactionCsvParseFailureReason; detail?: string };

  /**
   * 取引の取込前に既存データと突き合わせた結果
   * (docs/transaction-import-requirements.md 7章のプレビュー)。
   *
   * 形は`AssetBalanceImportPlan`と同じだが、突き合わせの鍵が違う(あちらは日付、
   * こちらはマネーフォワードの`ID`)。取り違えないよう型を分ける。
   */
  type TransactionImportPlan = {
    /** まだFirestoreに無い`ID`の件数 */
    newCount: number;
    /** 既にある`ID`の件数(取込で上書きされる) */
    updatedCount: number;
  };

  /**
   * 取引の取込実行の結果。
   *
   * 500件を超える取込は`writeBatch`の上限で複数回に分けて確定するため、途中で失敗しても
   * それまでのバッチはFirestoreに残る。失敗時も何件反映されたかを返し、画面が
   * 「全部失敗した」と誤解させないようにする(`AssetBalanceImportResult`と同じ扱い)。
   */
  type TransactionImportResult =
    | { ok: true; writtenCount: number }
    | { ok: false; reason: CsvImportFailureReason; writtenCount: number };

  /** 取込前に既存データと突き合わせた結果 */
  type AssetBalanceImportPlan = {
    /** まだFirestoreに無い日付の件数 */
    newCount: number;
    /** 既にある日付の件数(取込で上書きされる) */
    updatedCount: number;
  };

  /**
   * 取込実行の結果。
   *
   * 500件を超える取込は`writeBatch`の上限で複数回に分けて確定するため、途中で失敗しても
   * それまでのバッチはFirestoreに残る。失敗時も何件反映されたかを返し、画面が
   * 「全部失敗した」と誤解させないようにする。
   */
  type AssetBalanceImportResult =
    | { ok: true; writtenCount: number }
    | { ok: false; reason: CsvImportFailureReason; writtenCount: number };

  /**
   * 取込実行・既存データ照会が失敗した理由。
   *
   * Firestoreへのアクセス自体の失敗(`FirestoreAccessFailureReason`)に、B2固有の
   * 「資産残高は反映できたが履歴だけ残せなかった」を足したもの。
   */
  type CsvImportFailureReason =
    | FirestoreAccessFailureReason
    /** 資産残高は反映できたが、取込履歴だけ残せなかった */
    | "history-write-failed";

  /** 直近の取込履歴の1件(B2の表示項目) */
  type CsvImportHistoryEntry = {
    id: string;
    typeId: CsvImportTypeId;
    /** 取り込んだファイル名 */
    fileName: string;
    /** 反映した行数 */
    rowCount: number;
    /** 取込日時(ISO 8601)。書き込み直後でサーバー時刻が未確定の間は`null` */
    importedAt: string | null;
    /** 取り込んだデータの期間(`yyyy-MM-dd`) */
    periodFrom: string;
    periodTo: string;
  };

  /** 取込履歴カードのProps */
  type CsvImportHistoryCardProps = {
    entries: CsvImportHistoryEntry[];
    /** 履歴をまだ読み込めていない間は`true` */
    loading: boolean;
  };

  /** プレビュー表(全列を横スクロールで見せる)のProps */
  type CsvPreviewTableProps = {
    assetTypes: string[];
    /** 先頭から`CSV_PREVIEW_ROW_LIMIT`件に絞った行 */
    rows: AssetBalanceRow[];
  };

  /** 資産残高推移タブの中身のProps */
  type AssetBalanceImportPanelProps = {
    /** 取込完了を親に伝えて履歴を再取得させる */
    onImported: () => void;
  };

  /** ファイル選択・ドラッグ&ドロップの受け口のProps */
  type CsvDropzoneProps = {
    /** 選択中のファイル名。未選択は`null` */
    fileName: string | null;
    /** 読み込み中は操作を止める */
    disabled: boolean;
    onFileSelect: (file: File) => void;
  };
}
