/** B2 入出金明細CSV取込で使う定数(docs/transaction-import-requirements.md) */

import { CSV_DATE_FORMAT } from "@/constants/csv-import";

/**
 * 入出金明細CSVの列名(docs/transaction-import-requirements.md 2.1)。
 *
 * 資産残高推移と違い列の顔ぶれは固定なので、列名をここに持てる。ただし
 * **列の順序には依存せずヘッダー行の名前で引く**。マネーフォワードのエクスポートは
 * 非公式フォーマットで、列が増えることも並びが変わることもありうるため。
 */
export const TRANSACTION_CSV_COLUMNS = {
  isCalculationTarget: "計算対象",
  date: "日付",
  content: "内容",
  amount: "金額（円）",
  account: "保有金融機関",
  categoryMajor: "大項目",
  categoryMinor: "中項目",
  memo: "メモ",
  isTransfer: "振替",
  id: "ID",
} as const;

/**
 * 列が無くてもパースを通す列のキー。
 *
 * メモだけは3.1が「未設定・**列が無い場合**は空文字」と決めている。他の列は
 * 存在しなければ`missing-column`で弾く(値が空であることは許す。2.1)。
 */
export const OPTIONAL_TRANSACTION_CSV_COLUMN_KEYS: TransactionCsvColumnKey[] = ["memo"];

/** `計算対象` / `振替` が取る値。これ以外は`invalid-flag`(2.3) */
export const TRANSACTION_FLAG_TRUE = "1";
export const TRANSACTION_FLAG_FALSE = "0";

/**
 * 文字列の列の上限文字数(docs/transaction-import-requirements.md 3.1)。
 *
 * 超える値があれば`too-long`でファイル全体を弾く。切り詰めて通すと、元のCSVを保存しない
 * 設計上その分は取り込み直しても戻らない。上限は現実の値より十分に大きいので、超えるのは
 * 列がずれているなどファイルが想定と違うときであり、そこで止まるほうが正しい。
 *
 * **`firestore.rules`側も同じ値で拒否する**(B2-2で追加する)。片方だけを動かさないこと。
 */
export const TRANSACTION_CONTENT_MAX_LENGTH = 200;
export const TRANSACTION_ACCOUNT_MAX_LENGTH = 100;
export const TRANSACTION_CATEGORY_MAX_LENGTH = 40;
export const TRANSACTION_MEMO_MAX_LENGTH = 1_000;

/**
 * マネーフォワードの`ID`をFirestoreのドキュメントIDに使うための検証
 * (docs/transaction-import-requirements.md 3.2)。
 *
 * 使えない値を加工して通す案は採らない。加工するとアプリ側のIDが実装の都合で決まり、
 * 加工規則を変えた瞬間に同じ取引が二重に入る。外れた行が1件でもあれば`invalid-id`として
 * ファイル全体を弾く。
 *
 * 200文字はFirestoreの上限(1500バイト)より十分に小さい値で、実際の`ID`ははるかに短い。
 */
export const TRANSACTION_ID_MAX_LENGTH = 200;
export const TRANSACTION_ID_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{1,${TRANSACTION_ID_MAX_LENGTH}}$`,
  "u",
);

/**
 * `__…__`の形はFirestoreがドキュメントIDとして拒否するため、パーサー側でも弾く。
 * 上の文字種には収まってしまうので、パターンだけでは落とせない。
 */
export const RESERVED_DOCUMENT_ID_AFFIX = "__";

/**
 * 金額列として受け付ける形(桁区切りのカンマを外したあと)。
 *
 * 符号付きの整数のみ。**小数は弾く**(2.2 — 円未満の取引は無いため、現れたなら列が
 * ずれているか別のファイル)。資産残高推移は丸めて通すが、あちらは残高で、こちらは
 * 収支の集計に直接効くので扱いを変える。
 */
export const TRANSACTION_AMOUNT_PATTERN = /^-?\d+$/u;

/**
 * 1回に取り込める行数の上限(docs/transaction-import-requirements.md 8章)。
 *
 * 20,000件は`FIRESTORE_BATCH_LIMIT`(500件)で40バッチ。これを超えるなら期間を分けて
 * エクスポートしてもらう。資産残高推移の`MAX_ASSET_BALANCE_ROWS`とは値が同じだが、
 * 取引は際限なく増えるデータで動かす理由が別なので、参照せず独立した定数にしてある。
 */
export const MAX_TRANSACTION_ROWS = 20_000;

/** 必須列の一覧。`missing-column`の文言でどの列が要るかを示すために使う */
const REQUIRED_COLUMN_LABELS = Object.entries(TRANSACTION_CSV_COLUMNS)
  .filter(
    ([key]) => !OPTIONAL_TRANSACTION_CSV_COLUMN_KEYS.some((optionalKey) => optionalKey === key),
  )
  .map(([, columnName]) => `「${columnName}」`)
  .join("");

/**
 * パース失敗時の文言。要件どおり取込不可のまま画面に留まる。
 *
 * 資産残高推移の`CSV_PARSE_FAILURE_MESSAGES`とは理由の集合も文言も違うため、共有せず
 * 別に持つ。共有すると、どちらのタブで失敗したのか分からない案内になる。
 */
export const TRANSACTION_CSV_PARSE_FAILURE_MESSAGES: Record<
  TransactionCsvParseFailureReason,
  string
> = {
  "too-large":
    "ファイルサイズが大きすぎます。マネーフォワードの「収入・支出詳細」からエクスポートしたCSVを選択してください。",
  "empty-file":
    "ファイルが空です。マネーフォワードの「収入・支出詳細」からエクスポートしたCSVを選択してください。",
  "missing-column": `CSVの形式を読み取れませんでした。${REQUIRED_COLUMN_LABELS}の列を持つ、マネーフォワードの「収入・支出詳細」エクスポート形式のファイルを選択してください(ヘッダーと列数が食い違う行がある場合も、その行を示してこのエラーになります)。`,
  "duplicate-column":
    "同じ名前の列が複数あります。どちらの値を採用すべきか判断できないため取り込めません。",
  "no-data-rows": "取り込めるデータ行がありません。期間を指定してエクスポートし直してください。",
  "too-many-rows": `行数が多すぎます(上限${MAX_TRANSACTION_ROWS.toLocaleString("ja-JP")}行)。期間を分けてエクスポートしてください。`,
  "invalid-date": `日付として読み取れない値があります(${CSV_DATE_FORMAT}形式である必要があります)。`,
  "invalid-amount":
    "金額として読み取れない値があります。ファイルが編集されていないか確認してください。",
  "invalid-id": `取引IDとして読み取れない値があります(英数字・ハイフン・アンダースコアのみ、${TRANSACTION_ID_MAX_LENGTH}文字以内)。ファイルが編集されていないか確認してください。`,
  "duplicate-id":
    "同じ取引IDの行が重複しています。どちらの値を採用すべきか判断できないため取り込めません。",
  "invalid-flag": `「${TRANSACTION_CSV_COLUMNS.isCalculationTarget}」「${TRANSACTION_CSV_COLUMNS.isTransfer}」が${TRANSACTION_FLAG_FALSE}・${TRANSACTION_FLAG_TRUE}以外の値になっています。ファイルが編集されていないか確認してください。`,
  "too-long":
    "文字数の上限を超える値があります。列がずれていないか、ファイルが編集されていないか確認してください。",
  unreadable: "ファイルを読み取れませんでした。破損していないか確認してください。",
};

/**
 * 取込実行が失敗した理由ごとの文言。
 *
 * 理由の集合(`CsvImportFailureReason`)は資産残高推移と同じだが、`CSV_IMPORT_FAILURE_MESSAGES`は
 * `history-write-failed`が「資産残高は反映しましたが」と種別名を含むため共有できない。
 * 取込種別タブは両方が同時に組み立てられたまま並ぶので(`forceMount`)、どちらのタブの
 * 結果なのかが文言から分かる必要がある。
 */
export const TRANSACTION_IMPORT_FAILURE_MESSAGES: Record<CsvImportFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから取り込んでください。",
  "configuration-error": "Firebaseの設定が読み込めないため取り込めません。",
  "permission-denied": "このデータへの書き込みが許可されていません。ログインし直してください。",
  "history-write-failed":
    "取引は反映しましたが、取込履歴を残せませんでした。データは取り込めているため、取り込み直す必要はありません。",
  unknown: "取込に失敗しました。時間をおいて再度お試しください。",
};

/**
 * 途中まで反映された状態で失敗したときに添える説明。
 *
 * 500件を超える取込は`FIRESTORE_BATCH_LIMIT`ごとに確定するため、失敗しても手前のバッチは
 * 残る(docs/transaction-import-requirements.md 4章)。取り込み直せば揃うのは、同じ`ID`の
 * ドキュメントを上書きするためで、資産残高推移が日付で得ている性質と根拠が違う。
 */
export const buildTransactionPartialImportNotice = (writtenCount: number): string =>
  `${writtenCount.toLocaleString("ja-JP")}件はすでに反映されています。同じファイルを取り込み直すと残りも揃います(同じ取引IDは上書きされます)。`;
