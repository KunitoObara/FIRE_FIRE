export {};

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

  /** 取込実行・既存データ照会が失敗した理由 */
  type CsvImportFailureReason =
    | "signed-out"
    | "configuration-error"
    | "permission-denied"
    /** 資産残高は反映できたが、取込履歴だけ残せなかった */
    | "history-write-failed"
    | "unknown";

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
