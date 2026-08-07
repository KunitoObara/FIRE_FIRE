/** B2 CSV取込画面で使う定数(docs/screen-requirements-dashboard.md B2) */

import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";

/**
 * 取込種別タブ。
 *
 * 入出金明細は要件定義書7章のPhase 2の範囲で、B3 収支明細一覧もまだ無い。
 * タブ自体は要件の表示項目なので残し、中身は案内だけにする(`implemented`)。
 */
export const CSV_IMPORT_TYPES: CsvImportType[] = [
  {
    id: "asset-balance",
    label: "資産残高推移",
    description: "マネーフォワードの「資産推移」からエクスポートしたCSV",
    implemented: true,
  },
  {
    id: "transaction",
    label: "入出金明細",
    description: "マネーフォワードの「収入・支出詳細」からエクスポートしたCSV",
    implemented: false,
  },
];

/** 既定で開くタブ */
export const DEFAULT_CSV_IMPORT_TYPE_ID: CsvImportTypeId = "asset-balance";

/** 未実装の取込種別タブに出す案内 */
export const UNIMPLEMENTED_IMPORT_TYPE_NOTICE =
  "入出金明細の取込はPhase 2で対応します。現在は資産残高推移のCSVのみ取り込めます。";

/**
 * 資産残高推移CSVの列名。
 *
 * マネーフォワードのエクスポートは `"日付","合計（円）","預金・現金（円）",…` の横持ちで、
 * 日付と合計以外の列は保有状況によって増減する。したがって固定するのはこの2列だけとし、
 * 残りは「（円）」を落とした名前を資産種別として扱う。
 */
export const ASSET_BALANCE_DATE_COLUMN = "日付";
export const ASSET_BALANCE_TOTAL_COLUMN = "合計（円）";

/** 金額列の名前に付く単位。資産種別名を取り出すときに落とす(全角カッコである点に注意) */
export const AMOUNT_COLUMN_SUFFIX = "（円）";

/** CSVの日付の書式(例: `2026/07/31`) */
export const CSV_DATE_FORMAT = "yyyy/MM/dd";

/** アプリ内で日付を持つ書式。FirestoreのドキュメントIDにもこれを使う */
export const STORED_DATE_FORMAT = "yyyy-MM-dd";

/** プレビューに出すサンプル行の件数(docs/screen-requirements-dashboard.md B2「サンプル行」) */
export const CSV_PREVIEW_ROW_LIMIT = 5;

/**
 * 受け付けるCSVファイルの上限。
 * 資産推移は1日1行なので10年分でも数万行に届かない。取り違えて別の巨大ファイルを
 * 選んだときにブラウザを固まらせないための歯止めとして置く。
 */
export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_BALANCE_ROWS = 20_000;

/** ファイル選択ダイアログで絞り込む拡張子 */
export const CSV_FILE_ACCEPT = ".csv,text/csv";

/**
 * Firestoreの`writeBatch`が1回で扱える書き込みの上限。
 * これを超える行数は分割して書き込む。
 */
export const FIRESTORE_BATCH_LIMIT = 500;

/** パース失敗時の文言。要件どおり取込不可のまま画面に留まる */
export const CSV_PARSE_FAILURE_MESSAGES: Record<CsvParseFailureReason, string> = {
  "too-large":
    "ファイルサイズが大きすぎます。マネーフォワードからエクスポートしたCSVを選択してください。",
  "empty-file": "ファイルが空です。マネーフォワードからエクスポートしたCSVを選択してください。",
  "missing-column": `CSVの形式を読み取れませんでした。「${ASSET_BALANCE_DATE_COLUMN}」と「${ASSET_BALANCE_TOTAL_COLUMN}」の列を持つ、マネーフォワードの「資産推移」エクスポート形式のファイルを選択してください。`,
  "duplicate-column": `同じ名前の列が複数あります(「${ASSET_BALANCE_DATE_COLUMN}」「${ASSET_BALANCE_TOTAL_COLUMN}」または資産種別)。どちらの値を採用すべきか判断できないため取り込めません。`,
  "unnamed-column":
    "列名の無い列に値が入っています。どの資産種別として扱うか判断できないため取り込めません。",
  "no-data-rows": "取り込めるデータ行がありません。期間を指定してエクスポートし直してください。",
  "too-many-rows": `行数が多すぎます(上限${MAX_ASSET_BALANCE_ROWS.toLocaleString("ja-JP")}行)。期間を分けてエクスポートしてください。`,
  "invalid-date": `日付として読み取れない値があります(${CSV_DATE_FORMAT}形式である必要があります)。`,
  "invalid-amount":
    "金額として読み取れない値があります。ファイルが編集されていないか確認してください。",
  "duplicate-date":
    "同じ日付の行が重複しています。どちらの値を採用すべきか判断できないため取り込めません。",
  unreadable: "ファイルを読み取れませんでした。破損していないか確認してください。",
};

/** 取込実行が失敗した理由ごとの文言 */
export const CSV_IMPORT_FAILURE_MESSAGES: Record<CsvImportFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから取り込んでください。",
  "configuration-error": "Firebaseの設定が読み込めないため取り込めません。",
  "permission-denied": "このデータへの書き込みが許可されていません。ログインし直してください。",
  "history-write-failed":
    "資産残高は反映しましたが、取込履歴を残せませんでした。データは取り込めているため、取り込み直す必要はありません。",
  unknown: "取込に失敗しました。時間をおいて再度お試しください。",
};

/**
 * 途中まで反映された状態で失敗したときに添える説明。
 *
 * 500件を超える取込は複数回に分けて確定するため、失敗しても手前のバッチは残る。
 * 「失敗した=何も変わっていない」と受け取られると、実際の状態と食い違う。
 */
export const buildPartialImportNotice = (writtenCount: number): string =>
  `${writtenCount.toLocaleString("ja-JP")}件はすでに反映されています。同じファイルを取り込み直すと残りも揃います(同じ日付は上書きされます)。`;

/** 取込完了トーストの文言(DESIGN.md 7章でB2に割り当てたsonnerで出す) */
export const buildImportSuccessMessage = (writtenCount: number): string =>
  `取込が完了しました(${writtenCount.toLocaleString("ja-JP")}件を反映しました)`;

/** 取込履歴がまだ1件も無いときの表示 */
export const NO_IMPORT_HISTORY_LABEL = "取込履歴はまだありません。";

/** 取込履歴の表示件数。「直近の取込履歴」なので種別ごとに最新のものが見えれば足りる */
export const IMPORT_HISTORY_LIMIT = 5;

/**
 * B1が資産推移を組み立てるときに読む資産残高の上限件数。
 *
 * マネーフォワードの「資産推移」は当月が日次・それ以前は月末日のみなので、10年分でも
 * 数百件にしかならない。日次で蓄積し続けたアカウントでも読み込みが青天井にならないための
 * 歯止めとして置く。新しい日付から順に読むため、上限に達しても切り落とされるのは古い側だけ。
 *
 * 値は`FIRESTORE_QUERY_LIMIT_MAX`(Firestoreが`limit()`に許す最大値)そのものにしてある。
 * この上限は歯止めであって、小さくして得られるものが特に無いため、遡れる期間が最大になる
 * 側に寄せる。日次で溜め続けても約27年分にあたる。**これより大きい値は置けない。**
 * 超えるとクエリが`invalid-argument`で拒否され、1件も読めなくなる(B1-3)。
 *
 * 値は現状`MAX_ASSET_BALANCE_ROWS`の半分だが、そちらを参照せず独立した定数にしてある。
 * 前者は「1回のCSV取込で許容する行数」(パース時のガード)、こちらは「蓄積済みの資産残高を
 * 読み返す件数」(表示時の読み取りコストのガード)で、変えたくなる理由が別々のため。
 */
export const ASSET_SNAPSHOT_SCAN_LIMIT = FIRESTORE_QUERY_LIMIT_MAX;

/** 取込履歴のキャッシュキー(TanStack Query) */
export const IMPORT_HISTORY_QUERY_KEY = ["csv-imports"] as const;
