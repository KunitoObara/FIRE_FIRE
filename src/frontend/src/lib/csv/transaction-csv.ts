import { format, isValid, parse } from "date-fns";
import Papa from "papaparse";

import { CSV_DATE_FORMAT, STORED_DATE_FORMAT } from "@/constants/csv-import";
import {
  MAX_TRANSACTION_ROWS,
  OPTIONAL_TRANSACTION_CSV_COLUMN_KEYS,
  RESERVED_DOCUMENT_ID_AFFIX,
  TRANSACTION_ACCOUNT_MAX_LENGTH,
  TRANSACTION_AMOUNT_PATTERN,
  TRANSACTION_CATEGORY_MAX_LENGTH,
  TRANSACTION_CONTENT_MAX_LENGTH,
  TRANSACTION_CSV_COLUMNS,
  TRANSACTION_FLAG_FALSE,
  TRANSACTION_FLAG_TRUE,
  TRANSACTION_ID_PATTERN,
  TRANSACTION_MEMO_MAX_LENGTH,
} from "@/constants/transactions-import";
import { csvTableSchema } from "@/schemas/csv-import";

/**
 * マネーフォワードの「収入・支出詳細」CSVのパース
 * (docs/transaction-import-requirements.md 2章)。
 *
 * 実ファイルの形は次のとおり(値は形式を示すためのダミー。リポジトリは公開されるので、
 * 実際のエクスポートの数値も`ID`もテストにもドキュメントにも置かない)。
 *
 * ```
 * "計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"
 * "1","2026/07/31","スーパー〇〇","-3200","〇〇銀行","食費","食料品","","0","aaaa1111"
 * ```
 *
 * - 資産残高推移と違い**列の顔ぶれは固定**だが、順序には依存せず名前で引く。知らない列は
 *   無視する(2.1)。非公式フォーマットなので列が増えても取り込めるようにしておく
 * - 金額は**収入がプラス・支出がマイナス**。符号はそのまま保つ(5章「集計した値の符号」)
 * - `振替` / `計算対象` は捨てずに保存する。集計から外す行を、取り込まないのではなく
 *   取り込んだうえで除くため(5章)
 * - **同日・同額・同内容の取引は別々の行として残る。** 交通費などで実際に起きるので、
 *   行の同一性はマネーフォワードの`ID`だけで決める(4章で却下したハッシュ案)
 *
 * 形式不正は例外にせず理由付きで返す。要件どおり「エラー表示、取込不可のまま画面に留まる」
 * ために、呼び出し側が理由ごとの文言を出せるようにしている
 * (`TRANSACTION_CSV_PARSE_FAILURE_MESSAGES`)。
 */

type TransactionCsvColumnKey = keyof typeof TRANSACTION_CSV_COLUMNS;

/** 列名から引いた位置。メモ列だけは存在しないことがあり、その場合は`-1`が入る */
type TransactionCsvHeader = Record<TransactionCsvColumnKey, number>;

/** CSVの行番号(ヘッダーを1行目とする)。エラー文言でユーザーに位置を伝えるために使う */
const toLineNumber = (dataRowIndex: number): number => dataRowIndex + 2;

/** `2026/07/31` を `2026-07-31` にする。読み取れない場合は`undefined` */
const parseDate = (raw: string | undefined): string | undefined => {
  const parsed = parse((raw ?? "").trim(), CSV_DATE_FORMAT, new Date());

  return isValid(parsed) ? format(parsed, STORED_DATE_FORMAT) : undefined;
};

/**
 * 金額セルを数値にする。桁区切りのカンマと先頭のマイナスを許し、**小数と空欄は弾く**。
 *
 * 資産残高推移は空欄を「その日は保有していなかった」として0にするが、取引に金額の無い行は
 * ありえないので0に倒さない。0円と読み替えると、金額が落ちたファイルが黙って取り込まれる。
 */
const parseAmount = (raw: string | undefined): number | undefined => {
  const normalized = (raw ?? "").trim().replace(/,/gu, "");

  return TRANSACTION_AMOUNT_PATTERN.test(normalized) ? Number(normalized) : undefined;
};

/** `計算対象` / `振替` の`0` / `1`を真偽値にする。それ以外は`undefined` */
const parseFlag = (raw: string | undefined): boolean | undefined => {
  const normalized = (raw ?? "").trim();

  if (normalized === TRANSACTION_FLAG_TRUE) {
    return true;
  }

  return normalized === TRANSACTION_FLAG_FALSE ? false : undefined;
};

/**
 * `ID`列の値がFirestoreのドキュメントIDとして使えるかを見る(3.2)。
 *
 * `__…__`は文字種の検査には収まってしまうがFirestore側が拒否するため、別に弾く。
 *
 * Firestoreの規則そのものは正規表現`__.*__`(最短4文字)なので、`__`・`___`だけは
 * 本来通る。**要件の文言どおり前後一致で弾き、そこは合わせない** — 通してよい値を
 * 弾いても取り込めない`ID`が1つ増えるだけだが、逆に倒すと書き込み時に初めて
 * 失敗し、パースの時点で止めるという2.3の前提が崩れる。
 */
const isUsableDocumentId = (value: string): boolean =>
  TRANSACTION_ID_PATTERN.test(value) &&
  !(value.startsWith(RESERVED_DOCUMENT_ID_AFFIX) && value.endsWith(RESERVED_DOCUMENT_ID_AFFIX));

/**
 * 文字列の列を読む。前後の空白だけ落とし、それ以上の正規化はしない(6章)。
 *
 * 空白を落とすのは、それが**画面で見えない差**だからで、残すと見た目が同じ費目が別々に
 * 集計される。全角/半角や大文字小文字は画面で見える差なので統一しない。
 *
 * 上限文字数を超えていれば`undefined`(=`too-long`)。列が無い場合(メモのみ)は空文字。
 */
const readText = (cells: string[], index: number, maxLength: number): string | undefined => {
  const value = (index === -1 ? "" : (cells[index] ?? "")).trim();

  return value.length > maxLength ? undefined : value;
};

/**
 * ヘッダー行から各列の位置を決める。
 *
 * 同じ名前の列が複数あればどちらを採るか決められないので弾く(2.1)。メモ以外の列が
 * 無ければ`missing-column`。知らない列はここで拾わないので自然に無視される。
 */
const readHeader = (
  headerCells: string[],
):
  | { ok: true; header: TransactionCsvHeader }
  | { ok: false; reason: TransactionCsvParseFailureReason } => {
  const trimmed = headerCells.map((columnName) => columnName.trim());
  const hasDuplicate = Object.values(TRANSACTION_CSV_COLUMNS).some((columnName) => {
    const first = trimmed.indexOf(columnName);

    return first !== -1 && first !== trimmed.lastIndexOf(columnName);
  });

  if (hasDuplicate) {
    return { ok: false, reason: "duplicate-column" };
  }

  const header: TransactionCsvHeader = {
    isCalculationTarget: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.isCalculationTarget),
    date: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.date),
    content: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.content),
    amount: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.amount),
    account: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.account),
    categoryMajor: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.categoryMajor),
    categoryMinor: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.categoryMinor),
    memo: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.memo),
    isTransfer: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.isTransfer),
    id: trimmed.indexOf(TRANSACTION_CSV_COLUMNS.id),
  };
  const hasMissing = Object.entries(header).some(
    ([key, index]) => index === -1 && !OPTIONAL_TRANSACTION_CSV_COLUMN_KEYS.includes(key),
  );

  if (hasMissing) {
    return { ok: false, reason: "missing-column" };
  }

  return { ok: true, header };
};

/** 1データ行を`TransactionCsvRow`にする。読み取れない値があれば理由を返す */
const readRow = (
  cells: string[],
  header: TransactionCsvHeader,
):
  | { ok: true; row: TransactionCsvRow }
  | { ok: false; reason: TransactionCsvParseFailureReason } => {
  const id = (cells[header.id] ?? "").trim();

  if (!isUsableDocumentId(id)) {
    return { ok: false, reason: "invalid-id" };
  }

  const date = parseDate(cells[header.date]);

  if (date === undefined) {
    return { ok: false, reason: "invalid-date" };
  }

  const amount = parseAmount(cells[header.amount]);

  if (amount === undefined) {
    return { ok: false, reason: "invalid-amount" };
  }

  const isCalculationTarget = parseFlag(cells[header.isCalculationTarget]);
  const isTransfer = parseFlag(cells[header.isTransfer]);

  if (isCalculationTarget === undefined || isTransfer === undefined) {
    return { ok: false, reason: "invalid-flag" };
  }

  const content = readText(cells, header.content, TRANSACTION_CONTENT_MAX_LENGTH);
  const account = readText(cells, header.account, TRANSACTION_ACCOUNT_MAX_LENGTH);
  const categoryMajor = readText(cells, header.categoryMajor, TRANSACTION_CATEGORY_MAX_LENGTH);
  const categoryMinor = readText(cells, header.categoryMinor, TRANSACTION_CATEGORY_MAX_LENGTH);
  const memo = readText(cells, header.memo, TRANSACTION_MEMO_MAX_LENGTH);

  if (
    content === undefined ||
    account === undefined ||
    categoryMajor === undefined ||
    categoryMinor === undefined ||
    memo === undefined
  ) {
    return { ok: false, reason: "too-long" };
  }

  return {
    ok: true,
    row: {
      id,
      date,
      content,
      amount,
      account,
      categoryMajor,
      categoryMinor,
      memo,
      isTransfer,
      isCalculationTarget,
    },
  };
};

/**
 * 入出金明細CSVをパースする。
 *
 * 失敗したときは**1件も取り込ませない**ため、最初に見つけた不正でその場で打ち切る(2.3)。
 * 成功時はCSVに現れた順の行と、プレビューに出す期間を返す。
 */
export const parseTransactionCsv = (text: string): TransactionCsvParseResult => {
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

  if (dataRows.length === 0) {
    return { ok: false, reason: "no-data-rows" };
  }

  if (dataRows.length > MAX_TRANSACTION_ROWS) {
    return { ok: false, reason: "too-many-rows" };
  }

  const rows: TransactionCsvRow[] = [];
  const seenIds = new Set<string>();

  for (const [index, cells] of dataRows.entries()) {
    // 列が足りない行は形式が違う。ヘッダーより多い分は「知らない列」として無視する(2.1)
    if (cells.length < headerCells.length) {
      return { ok: false, reason: "missing-column", detail: `${toLineNumber(index)}行目` };
    }

    const result = readRow(cells, headerResult.header);

    if (!result.ok) {
      return { ok: false, reason: result.reason, detail: `${toLineNumber(index)}行目` };
    }

    // 同じ`ID`が2度現れると、どちらの内容で上書きするかがファイル内の順序で決まってしまう。
    // 冪等性は`ID`が取引と1対1であることに依存している(4章)ので、崩れていたら取り込まない
    if (seenIds.has(result.row.id)) {
      return { ok: false, reason: "duplicate-id", detail: `${toLineNumber(index)}行目` };
    }

    seenIds.add(result.row.id);
    rows.push(result.row);
  }

  // 行は並べ替えないので、期間は最小・最大を取り直す(`yyyy-MM-dd`は辞書順=日付順)
  const dates = rows.map((row) => row.date).sort((left, right) => left.localeCompare(right));
  const periodFrom = dates[0];
  const periodTo = dates[dates.length - 1];

  if (periodFrom === undefined || periodTo === undefined) {
    return { ok: false, reason: "no-data-rows" };
  }

  return { ok: true, parsed: { rows, periodFrom, periodTo } };
};
