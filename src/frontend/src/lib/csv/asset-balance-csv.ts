import { format, isValid, parse } from "date-fns";
import Papa from "papaparse";

import {
  AMOUNT_COLUMN_SUFFIX,
  ASSET_BALANCE_DATE_COLUMN,
  ASSET_BALANCE_TOTAL_COLUMN,
  CSV_DATE_FORMAT,
  MAX_ASSET_BALANCE_ROWS,
  STORED_DATE_FORMAT,
} from "@/constants/csv-import";
import { csvTableSchema } from "@/schemas/csv-import";

/**
 * マネーフォワードの「資産推移」CSVのパース(docs/screen-requirements-dashboard.md B2)。
 *
 * 実ファイルの形は次のとおり。
 *
 * ```
 * "日付","合計（円）","預金・現金（円）","株式(現物)（円）",…
 * "2026/07/31","62810170","3173852","53994",…
 * ```
 *
 * - 資産種別が列になった横持ちで、**列の顔ぶれは保有状況によって変わる**。列名をコードに
 *   持たず、日付と合計以外はすべて資産種別として扱う(4.3の拡張性要件)
 * - 「合計（円）」は各種別の合算だが、CSV側の値をそのまま採る。マネーフォワードが
 *   どこまでを合計に含めるかを画面側で推測して再計算すると、表示が本家とずれるため
 * - 行は新しい日付が先頭。当月は日次、それ以前は月末日のみという混在があるので、
 *   日付の間隔には一切前提を置かない
 *
 * 形式不正は例外にせず理由付きで返す。要件どおり「エラー表示、取込不可のまま画面に留まる」
 * ために、呼び出し側が理由ごとの文言を出せるようにしている。
 */

/** 日付・金額の桁が化けたまま取り込まれるのを防ぐため、円単位の数値だけを受け付ける */
const AMOUNT_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * 金額セルを数値にする。空欄はその日にその資産種別を保有していなかったとみなして0とする
 * (マネーフォワードは0を明示するが、期間の区切り方によっては空欄になりうる)。
 */
const parseAmount = (raw: string | undefined): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.trim().replace(/,/gu, "");

  if (normalized === "") {
    return 0;
  }

  if (!AMOUNT_PATTERN.test(normalized)) {
    return undefined;
  }

  // 円未満は保持しない。資産額は円単位の整数として扱う(src/lib/format/currency.ts)
  return Math.round(Number(normalized));
};

/** `2026/07/31` を `2026-07-31` にする。読み取れない場合は`undefined` */
const parseDate = (raw: string | undefined): string | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parse(raw.trim(), CSV_DATE_FORMAT, new Date());

  return isValid(parsed) ? format(parsed, STORED_DATE_FORMAT) : undefined;
};

/** 列名から単位の「（円）」を落として資産種別名にする */
const toAssetTypeName = (columnName: string): string =>
  columnName.endsWith(AMOUNT_COLUMN_SUFFIX)
    ? columnName.slice(0, -AMOUNT_COLUMN_SUFFIX.length)
    : columnName;

/** CSVの行番号(ヘッダーを1行目とする)。エラー文言でユーザーに位置を伝えるために使う */
const toLineNumber = (dataRowIndex: number): number => dataRowIndex + 2;

type AssetTypeColumn = { index: number; name: string };

type AssetBalanceHeader = {
  dateIndex: number;
  totalIndex: number;
  assetTypeColumns: AssetTypeColumn[];
  /** 列名が空の列の位置。値が入っていないかを行ごとに確かめるために持つ */
  unnamedIndexes: number[];
};

/**
 * ヘッダー行から、日付・合計・資産種別それぞれの列位置を決める。
 *
 * 資産種別は名前をキーにしたマップに入れるため、単位を落とした結果同じ名前になる列が
 * 2つあると片方の金額が黙って消える。それは取り込んでよい状態ではないので理由を返して弾く。
 */
const readHeader = (
  header: string[],
): { ok: true; header: AssetBalanceHeader } | { ok: false; reason: CsvParseFailureReason } => {
  const trimmed = header.map((column) => column.trim());
  const dateIndex = trimmed.indexOf(ASSET_BALANCE_DATE_COLUMN);
  const totalIndex = trimmed.indexOf(ASSET_BALANCE_TOTAL_COLUMN);

  if (dateIndex === -1 || totalIndex === -1) {
    return { ok: false, reason: "missing-column" };
  }

  // 日付・合計が複数あると`indexOf`が拾わなかった方が資産種別として扱われる。
  // 資産種別名の重複と同じく、どの列を採るべきか決められないので弾く
  const isDuplicated = (columnName: string): boolean =>
    trimmed.indexOf(columnName) !== trimmed.lastIndexOf(columnName);

  if (isDuplicated(ASSET_BALANCE_DATE_COLUMN) || isDuplicated(ASSET_BALANCE_TOTAL_COLUMN)) {
    return { ok: false, reason: "duplicate-column" };
  }

  const namedColumns = trimmed
    .map((name, index) => ({ index, name: toAssetTypeName(name) }))
    .filter((column) => column.index !== dateIndex && column.index !== totalIndex);

  const assetTypeColumns = namedColumns.filter((column) => column.name.length > 0);
  const uniqueNames = new Set(assetTypeColumns.map((column) => column.name));

  if (uniqueNames.size !== assetTypeColumns.length) {
    return { ok: false, reason: "duplicate-column" };
  }

  return {
    ok: true,
    header: {
      dateIndex,
      totalIndex,
      assetTypeColumns,
      // 名前の無い列。行末のカンマで空の列が1つ増えるだけなら無視してよいが、
      // 値が入っているなら取り込めないので、行を読むときに中身を確かめる
      unnamedIndexes: namedColumns
        .filter((column) => column.name.length === 0)
        .map((column) => column.index),
    },
  };
};

/** 1データ行を`AssetBalanceRow`にする。金額・日付が読めない場合は理由を返す */
const readRow = (
  cells: string[],
  header: AssetBalanceHeader,
): { ok: true; row: AssetBalanceRow } | { ok: false; reason: CsvParseFailureReason } => {
  const date = parseDate(cells[header.dateIndex]);

  if (date === undefined) {
    return { ok: false, reason: "invalid-date" };
  }

  const total = parseAmount(cells[header.totalIndex]);

  if (total === undefined) {
    return { ok: false, reason: "invalid-amount" };
  }

  const byType: Record<string, number> = {};

  for (const column of header.assetTypeColumns) {
    const amount = parseAmount(cells[column.index]);

    if (amount === undefined) {
      return { ok: false, reason: "invalid-amount" };
    }

    byType[column.name] = amount;
  }

  // 列名が無い列に値が入っていたら、どの資産種別として扱えばよいか決められない。
  // 名前が無いことを理由に黙って捨てると、その分だけ内訳が実態とずれる
  const hasUnnamedValue = header.unnamedIndexes.some(
    (index) => (cells[index] ?? "").trim().length > 0,
  );

  if (hasUnnamedValue) {
    return { ok: false, reason: "unnamed-column" };
  }

  return { ok: true, row: { date, total, byType } };
};

/**
 * 資産残高推移CSVをパースする。
 *
 * 成功時は日付の昇順に並べ替えた行と、プレビューに出す期間・資産種別を返す。
 */
export const parseAssetBalanceCsv = (text: string): AssetBalanceParseResult => {
  if (text.trim() === "") {
    return { ok: false, reason: "empty-file" };
  }

  // ヘッダーの重複や列数の揺れを自分で扱いたいので、配列のまま受け取る。
  // papaparseの戻り値は型引数を渡しても実行時には保証されないため、外部入力として
  // zodで形を確かめてから使う(CODING_STANDARDS.md 1章)
  const table = csvTableSchema.safeParse(Papa.parse(text, { skipEmptyLines: "greedy" }).data);

  if (!table.success) {
    return { ok: false, reason: "unreadable" };
  }

  const [headerCells, ...dataRows] = table.data;

  if (headerCells === undefined) {
    return { ok: false, reason: "empty-file" };
  }

  const headerResult = readHeader(headerCells);

  if (!headerResult.ok) {
    return { ok: false, reason: headerResult.reason };
  }

  const { header } = headerResult;

  if (dataRows.length === 0) {
    return { ok: false, reason: "no-data-rows" };
  }

  if (dataRows.length > MAX_ASSET_BALANCE_ROWS) {
    return { ok: false, reason: "too-many-rows" };
  }

  const rows: AssetBalanceRow[] = [];
  const seenDates = new Set<string>();

  for (const [index, cells] of dataRows.entries()) {
    // 末尾のカンマで空の列が1つ増えることはあるが、足りない行は形式が違う
    if (cells.length < headerCells.length) {
      return { ok: false, reason: "missing-column", detail: `${toLineNumber(index)}行目` };
    }

    const result = readRow(cells, header);

    if (!result.ok) {
      return { ok: false, reason: result.reason, detail: `${toLineNumber(index)}行目` };
    }

    if (seenDates.has(result.row.date)) {
      return { ok: false, reason: "duplicate-date", detail: `${toLineNumber(index)}行目` };
    }

    seenDates.add(result.row.date);
    rows.push(result.row);
  }

  // CSVは新しい日付が先頭。推移として扱うため昇順に直してから返す
  rows.sort((left, right) => left.date.localeCompare(right.date));

  const periodFrom = rows[0]?.date;
  const periodTo = rows[rows.length - 1]?.date;

  if (periodFrom === undefined || periodTo === undefined) {
    return { ok: false, reason: "no-data-rows" };
  }

  return {
    ok: true,
    parsed: {
      assetTypes: header.assetTypeColumns.map((column: AssetTypeColumn) => column.name),
      rows,
      periodFrom,
      periodTo,
    },
  };
};
