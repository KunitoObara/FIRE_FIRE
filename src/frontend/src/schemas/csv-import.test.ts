import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";

import { csvImportHistoryDocumentSchema, csvTableSchema } from "@/schemas/csv-import";

const validHistory = {
  typeId: "asset-balance",
  fileName: "資産推移月次.csv",
  rowCount: 133,
  periodFrom: "2018-01-31",
  periodTo: "2026-07-31",
  importedAt: Timestamp.fromDate(new Date("2026-07-31T12:34:56.000Z")),
};

describe("csvImportHistoryDocumentSchema", () => {
  it("取込履歴のドキュメントを受け付ける", () => {
    expect(csvImportHistoryDocumentSchema.safeParse(validHistory).success).toBe(true);
  });

  /** `serverTimestamp()`はサーバー時刻が確定するまで`null`で返る。欠損ではない */
  it("サーバー時刻が未確定の取込日時を許す", () => {
    const parsed = csvImportHistoryDocumentSchema.safeParse({
      ...validHistory,
      importedAt: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("画面のタブに無い取込種別を弾く", () => {
    const parsed = csvImportHistoryDocumentSchema.safeParse({
      ...validHistory,
      typeId: "unknown-type",
    });

    expect(parsed.success).toBe(false);
  });

  it("件数が数値でないドキュメントを弾く", () => {
    const parsed = csvImportHistoryDocumentSchema.safeParse({ ...validHistory, rowCount: "133" });

    expect(parsed.success).toBe(false);
  });

  it("項目が欠けたドキュメントを弾く", () => {
    const missing: Record<string, unknown> = { ...validHistory };
    delete missing.periodTo;

    expect(csvImportHistoryDocumentSchema.safeParse(missing).success).toBe(false);
  });
});

describe("csvTableSchema", () => {
  it("文字列の二次元配列を受け付ける", () => {
    expect(
      csvTableSchema.safeParse([
        ["日付", "合計（円）"],
        ["2026/07/31", "100"],
      ]).success,
    ).toBe(true);
  });

  /** papaparseの設定を変えるとオブジェクトや数値が返りうる。素通りさせない */
  it("セルが文字列でない表を弾く", () => {
    expect(csvTableSchema.safeParse([[2026, 100]]).success).toBe(false);
    expect(csvTableSchema.safeParse([{ 日付: "2026/07/31" }]).success).toBe(false);
  });
});
