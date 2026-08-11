import { CSV_PREVIEW_ROW_LIMIT } from "@/constants/csv-import";

/**
 * 取込前プレビューに出す値の組み立て(docs/transaction-import-requirements.md 7章)。
 *
 * 件数・期間・新規/上書きの内訳はパース結果と`buildTransactionImportPlan`から直接読めるので、
 * ここで作るのは「集計から外れる件数」とサンプル行だけになる。
 */

/**
 * 収支の集計から外れる行を数える(5章)。
 *
 * **1行を1つの理由にだけ数える。** 振替の行が同時に計算対象外であることは実際にあり、
 * それぞれの条件で独立に数えると内訳の和が合計を超える。プレビューは取込前に中身を
 * 確かめるための表示なので、足して合わない数字が並ぶと確かめようが無くなる。
 *
 * 振替を先に見るのは、それがマネーフォワードが自動で付ける分類だからで、`計算対象`の側は
 * ユーザーが下した判断になる(5章)。どちらか一方に寄せる必要があるなら、機械が付けた
 * 分類のほうを理由として示すほうが、行を突き合わせたときに納得しやすい。
 *
 * なお除外の対象になる行も**Firestoreへは保存する**。取り込まないとB3の一覧に出ず、
 * 取込に失敗したのか集計から外れただけなのかを画面から区別できなくなる(5章)。
 */
export const summarizeExcludedTransactions = (
  rows: readonly TransactionCsvRow[],
): TransactionExclusionSummary => {
  const transferCount = rows.filter((row) => row.isTransfer).length;
  const nonCalculationTargetCount = rows.filter(
    (row) => !row.isTransfer && !row.isCalculationTarget,
  ).length;

  return {
    excludedCount: transferCount + nonCalculationTargetCount,
    transferCount,
    nonCalculationTargetCount,
  };
};

/**
 * プレビューに出すサンプル行。
 *
 * 資産残高推移が末尾から取って並べ替えるのに対し、こちらは**先頭から順にそのまま**取る。
 * パーサーがCSVに現れた順(マネーフォワードのエクスポートは新しい日付が先頭)を保っており、
 * 同じ日に何件でも取引が並ぶため日付で並べ替えても順序が一意に定まらない
 * (`TransactionCsvParsed.rows`のコメント)。ファイルを開いて見える並びと同じものを見せる。
 */
export const toTransactionPreviewRows = (rows: TransactionCsvRow[]): TransactionCsvRow[] =>
  rows.slice(0, CSV_PREVIEW_ROW_LIMIT);
