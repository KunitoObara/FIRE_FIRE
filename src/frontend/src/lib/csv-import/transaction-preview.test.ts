import { describe, expect, it } from "vitest";

import { CSV_PREVIEW_ROW_LIMIT } from "@/constants/csv-import";
import {
  summarizeExcludedTransactions,
  toTransactionPreviewRows,
} from "@/lib/csv-import/transaction-preview";

/** 検証したい列だけを指定して1行を作る。金額や口座は集計の判定に関係しない */
const buildRow = (row: Partial<TransactionCsvRow> & { id: string }): TransactionCsvRow => ({
  date: "2026-07-31",
  content: "サンプル",
  amount: -1000,
  account: "〇〇銀行",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...row,
});

describe("summarizeExcludedTransactions", () => {
  it("振替も計算対象外も無ければ0件になる", () => {
    const summary = summarizeExcludedTransactions([buildRow({ id: "a1" }), buildRow({ id: "a2" })]);

    expect(summary).toEqual({
      excludedCount: 0,
      transferCount: 0,
      nonCalculationTargetCount: 0,
    });
  });

  it("振替と計算対象外をそれぞれ数える", () => {
    const summary = summarizeExcludedTransactions([
      buildRow({ id: "a1" }),
      buildRow({ id: "a2", isTransfer: true }),
      buildRow({ id: "a3", isCalculationTarget: false }),
      buildRow({ id: "a4", isCalculationTarget: false }),
    ]);

    expect(summary).toEqual({
      excludedCount: 3,
      transferCount: 1,
      nonCalculationTargetCount: 2,
    });
  });

  /**
   * 振替かつ計算対象外の行は実際にある。両方で数えると内訳の和が合計を超え、
   * プレビューに足して合わない数字が並ぶ
   */
  it("振替かつ計算対象外の行は振替としてだけ数え、内訳の和を合計に一致させる", () => {
    const summary = summarizeExcludedTransactions([
      buildRow({ id: "a1", isTransfer: true, isCalculationTarget: false }),
    ]);

    expect(summary).toEqual({
      excludedCount: 1,
      transferCount: 1,
      nonCalculationTargetCount: 0,
    });
    expect(summary.transferCount + summary.nonCalculationTargetCount).toBe(summary.excludedCount);
  });
});

describe("toTransactionPreviewRows", () => {
  it("CSVに現れた順のまま先頭から上限件数だけ返す", () => {
    const rows = Array.from({ length: CSV_PREVIEW_ROW_LIMIT + 3 }, (_, index) =>
      buildRow({ id: `a${index}` }),
    );

    const previewRows = toTransactionPreviewRows(rows);

    expect(previewRows).toHaveLength(CSV_PREVIEW_ROW_LIMIT);
    expect(previewRows.map((row) => row.id)).toEqual(
      rows.slice(0, CSV_PREVIEW_ROW_LIMIT).map((row) => row.id),
    );
  });

  it("上限に満たない場合は全件返す", () => {
    const rows = [buildRow({ id: "a1" }), buildRow({ id: "a2" })];

    expect(toTransactionPreviewRows(rows)).toHaveLength(2);
  });
});
