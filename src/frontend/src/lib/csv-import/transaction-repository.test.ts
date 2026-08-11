import { beforeEach, describe, expect, it, vi } from "vitest";

import { FIRESTORE_BATCH_LIMIT } from "@/constants/csv-import";
import { TRANSACTION_SCAN_LIMIT } from "@/constants/transactions";
import {
  buildTransactionImportPlan,
  fetchTransactions,
  importTransactions,
} from "@/lib/csv-import/transaction-repository";

/**
 * Firestoreへの書き込みは実際には行わず、SDKの呼び出しだけを記録して確かめる。
 *
 * ここで固めたいのは「どのドキュメントIDに、何を、何回に分けて書くか」で、それは
 * 再取込の冪等性(docs/transaction-import-requirements.md 4章)がIDに依存しているため。
 * ルールそのものは`firebase emulators:exec`と`firestore-rules-review`で見る。
 */

const set = vi.fn();
const commit = vi.fn();
const getDocs = vi.fn();
const resolveFirestoreUserContext = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (_firestore: unknown, ...path: string[]) => ({ path: path.join("/") }),
  // 自動IDのドキュメント(取込履歴)は`id`を渡さずに引く
  doc: (ref: { path: string }, id?: string) => ({ path: `${ref.path}/${id ?? "auto-id"}` }),
  getDocs: (...args: unknown[]) => getDocs(...args),
  limit: (count: number) => ({ limit: count }),
  orderBy: (field: string, direction: string) => ({ orderBy: field, direction }),
  query: (ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }),
  serverTimestamp: () => "server-timestamp",
  where: (field: string, operator: string, value: unknown) => ({ field, operator, value }),
  writeBatch: () => ({
    set: (...args: unknown[]) => set(...args),
    commit: () => commit(),
  }),
  Timestamp: class {},
}));

vi.mock("@/lib/firebase/user-context", () => ({
  resolveFirestoreUserContext: () => resolveFirestoreUserContext(),
  toFirestoreFailureReason: () => "permission-denied",
}));

const buildRow = (overrides: Partial<TransactionCsvRow> = {}): TransactionCsvRow => ({
  id: "aaaa1111",
  date: "2026-07-31",
  content: "スーパー〇〇",
  amount: -3200,
  account: "〇〇銀行",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...overrides,
});

const buildParsed = (rows: TransactionCsvRow[]): TransactionCsvParsed => ({
  rows,
  periodFrom: "2026-07-01",
  periodTo: "2026-07-31",
});

/** 取引の書き込みだけを取り出す(取込履歴の書き込みと混ざるため) */
const transactionWrites = (): { path: string; data: Record<string, unknown> }[] =>
  set.mock.calls
    .map(([reference, data]) => ({
      path: (reference as { path: string }).path,
      data: data as Record<string, unknown>,
    }))
    .filter((write) => write.path.includes("/transactions/"));

beforeEach(() => {
  vi.clearAllMocks();
  resolveFirestoreUserContext.mockReturnValue({ ok: true, firestore: {}, uid: "uid-1" });
  commit.mockResolvedValue(undefined);
  getDocs.mockResolvedValue({ docs: [] });
});

describe("importTransactions", () => {
  it("マネーフォワードの`ID`をドキュメントIDにして書き込む", async () => {
    await importTransactions(buildParsed([buildRow({ id: "aaaa1111" })]), "収入・支出詳細.csv");

    expect(transactionWrites()[0]?.path).toBe("users/uid-1/transactions/aaaa1111");
  });

  it("`id`はドキュメントIDであってフィールドではないので、中身に混ぜない", async () => {
    await importTransactions(buildParsed([buildRow()]), "収入・支出詳細.csv");

    expect(transactionWrites()[0]?.data).toEqual({
      date: "2026-07-31",
      content: "スーパー〇〇",
      amount: -3200,
      account: "〇〇銀行",
      categoryMajor: "食費",
      categoryMinor: "食料品",
      memo: "",
      isTransfer: false,
      isCalculationTarget: true,
      importedAt: "server-timestamp",
    });
  });

  it("同じCSVを2回取り込んでも、同じドキュメントIDへの上書きにしかならない", async () => {
    const parsed = buildParsed([buildRow({ id: "aaaa1111" }), buildRow({ id: "bbbb2222" })]);

    await importTransactions(parsed, "収入・支出詳細.csv");
    const firstPaths = transactionWrites().map((write) => write.path);

    vi.clearAllMocks();
    commit.mockResolvedValue(undefined);

    await importTransactions(parsed, "収入・支出詳細.csv");

    expect(transactionWrites().map((write) => write.path)).toEqual(firstPaths);
    expect(firstPaths).toEqual([
      "users/uid-1/transactions/aaaa1111",
      "users/uid-1/transactions/bbbb2222",
    ]);
  });

  it("振替・計算対象外の行も保存する(集計から外すのは読み出し側)", async () => {
    const parsed = buildParsed([
      buildRow({ id: "aaaa1111", isTransfer: true }),
      buildRow({ id: "bbbb2222", isCalculationTarget: false }),
    ]);

    await importTransactions(parsed, "収入・支出詳細.csv");

    expect(transactionWrites().map((write) => write.data.isTransfer)).toEqual([true, false]);
    expect(transactionWrites().map((write) => write.data.isCalculationTarget)).toEqual([
      true,
      false,
    ]);
  });

  it("500件を超える取込を500件ずつのバッチに分ける", async () => {
    const rows = Array.from({ length: FIRESTORE_BATCH_LIMIT + 1 }, (_unused, index) =>
      buildRow({ id: `id${index}` }),
    );

    const result = await importTransactions(buildParsed(rows), "収入・支出詳細.csv");

    // 取引で2回(500件 + 1件)、取込履歴で1回
    expect(commit).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true, writtenCount: FIRESTORE_BATCH_LIMIT + 1 });
  });

  it("途中のバッチが失敗したら、そこまでに反映した件数を返す", async () => {
    const rows = Array.from({ length: FIRESTORE_BATCH_LIMIT + 1 }, (_unused, index) =>
      buildRow({ id: `id${index}` }),
    );
    commit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("失敗"));

    const result = await importTransactions(buildParsed(rows), "収入・支出詳細.csv");

    // 手前のバッチはFirestoreに残る。「全部失敗した」と伝えないための件数
    expect(result).toEqual({
      ok: false,
      reason: "permission-denied",
      writtenCount: FIRESTORE_BATCH_LIMIT,
    });
  });

  it("取込履歴に取込種別・件数・期間を残す", async () => {
    await importTransactions(buildParsed([buildRow()]), "収入・支出詳細.csv");

    const history = set.mock.calls
      .map(([reference, data]) => ({ path: (reference as { path: string }).path, data }))
      .find((write) => write.path.includes("/csvImports/"));

    expect(history?.data).toEqual({
      typeId: "transaction",
      fileName: "収入・支出詳細.csv",
      rowCount: 1,
      periodFrom: "2026-07-01",
      periodTo: "2026-07-31",
      importedAt: "server-timestamp",
    });
  });

  it("取引は反映できたが履歴だけ残せなかった場合は、区別できる理由と全件数を返す", async () => {
    commit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("失敗"));

    const result = await importTransactions(buildParsed([buildRow()]), "収入・支出詳細.csv");

    expect(result).toEqual({ ok: false, reason: "history-write-failed", writtenCount: 1 });
  });

  it("未ログインなら書き込みを試さない", async () => {
    resolveFirestoreUserContext.mockReturnValue({ ok: false, reason: "signed-out" });

    const result = await importTransactions(buildParsed([buildRow()]), "収入・支出詳細.csv");

    expect(result).toEqual({ ok: false, reason: "signed-out", writtenCount: 0 });
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("buildTransactionImportPlan", () => {
  it("CSVの期間に絞って既存の取引を引く", async () => {
    await buildTransactionImportPlan(buildParsed([buildRow()]));

    expect(getDocs).toHaveBeenCalledWith({
      ref: { path: "users/uid-1/transactions" },
      constraints: [
        { field: "date", operator: ">=", value: "2026-07-01" },
        { field: "date", operator: "<=", value: "2026-07-31" },
      ],
    });
  });

  it("既にある`ID`を上書き、無いものを新規として数える", async () => {
    getDocs.mockResolvedValue({ docs: [{ id: "aaaa1111" }, { id: "zzzz9999" }] });

    const result = await buildTransactionImportPlan(
      buildParsed([buildRow({ id: "aaaa1111" }), buildRow({ id: "bbbb2222" })]),
    );

    // 期間内にあっても今回のCSVに無い`zzzz9999`は数に入らない
    expect(result).toEqual({ ok: true, plan: { newCount: 1, updatedCount: 1 } });
  });

  it("照会に失敗したら理由を返す", async () => {
    getDocs.mockRejectedValue(new Error("失敗"));

    const result = await buildTransactionImportPlan(buildParsed([buildRow()]));

    expect(result).toEqual({ ok: false, reason: "permission-denied" });
  });

  it("未ログインなら照会しない", async () => {
    resolveFirestoreUserContext.mockReturnValue({ ok: false, reason: "signed-out" });

    const result = await buildTransactionImportPlan(buildParsed([buildRow()]));

    expect(result).toEqual({ ok: false, reason: "signed-out" });
    expect(getDocs).not.toHaveBeenCalled();
  });
});

/** B3が読むときの基準時刻。「直近1ヶ月」の境界が2026-06-30になる */
const NOW = new Date("2026-07-30T12:00:00+09:00");

/** Firestoreから返る取引ドキュメント1件分 */
const buildDocument = (
  id: string,
  overrides: Partial<Record<string, unknown>> = {},
): { id: string; data: () => Record<string, unknown> } => ({
  id,
  data: () => ({
    date: "2026-07-20",
    content: "スーパー〇〇",
    amount: -3200,
    account: "〇〇銀行",
    categoryMajor: "食費",
    categoryMinor: "食料品",
    memo: "",
    isTransfer: false,
    isCalculationTarget: true,
    importedAt: null,
    ...overrides,
  }),
});

describe("fetchTransactions", () => {
  it("選択中の期間で範囲を絞り、新しい順に1件余分読む", async () => {
    await fetchTransactions("1m", NOW);

    expect(getDocs).toHaveBeenCalledWith({
      ref: { path: "users/uid-1/transactions" },
      constraints: [
        { field: "date", operator: ">=", value: "2026-06-30" },
        { field: "date", operator: "<=", value: "2026-07-30" },
        { orderBy: "date", direction: "desc" },
        { limit: TRANSACTION_SCAN_LIMIT + 1 },
      ],
    });
  });

  /** 「全期間」は境界を持たない。`null`を`where`に渡すと日付として比較されてしまう */
  it("全期間では日付の条件を付けない", async () => {
    await fetchTransactions("all", NOW);

    expect(getDocs).toHaveBeenCalledWith({
      ref: { path: "users/uid-1/transactions" },
      constraints: [{ orderBy: "date", direction: "desc" }, { limit: TRANSACTION_SCAN_LIMIT + 1 }],
    });
  });

  it("ドキュメントIDを取引のIDにして返す", async () => {
    getDocs.mockResolvedValue({ docs: [buildDocument("aaaa1111")] });

    const result = await fetchTransactions("1m", NOW);

    expect(result).toEqual({
      ok: true,
      truncated: false,
      transactions: [
        expect.objectContaining({
          id: "aaaa1111",
          date: "2026-07-20",
          amount: -3200,
          content: "スーパー〇〇",
          categoryMajor: "食費",
          categoryMinor: "食料品",
          isTransfer: false,
          isCalculationTarget: true,
        }),
      ],
    });
  });

  /** 振替・計算対象外の行も一覧には出す(取り込んだのに消えたように見せない。5章) */
  it("振替・計算対象外の取引も返す", async () => {
    getDocs.mockResolvedValue({
      docs: [
        buildDocument("aaaa1111", { isTransfer: true }),
        buildDocument("bbbb2222", { isCalculationTarget: false }),
      ],
    });

    const result = await fetchTransactions("all", NOW);

    expect(result.ok && result.transactions).toHaveLength(2);
  });

  it("1件も無ければ失敗ではなく空で返す", async () => {
    getDocs.mockResolvedValue({ docs: [] });

    const result = await fetchTransactions("1m", NOW);

    expect(result).toEqual({ ok: true, transactions: [], truncated: false });
  });

  /**
   * 上限ちょうどで打ち切りの案内を出さない。データは欠けていないのに案内が出ると、
   * 本当に打ち切られたときの案内も信じられなくなる(8章)
   */
  it("上限ちょうどの件数では打ち切りと判定しない", async () => {
    getDocs.mockResolvedValue({
      docs: Array.from({ length: TRANSACTION_SCAN_LIMIT }, (_, index) =>
        buildDocument(`id-${index}`),
      ),
    });

    const result = await fetchTransactions("all", NOW);

    expect(result).toMatchObject({ ok: true, truncated: false });
    expect(result.ok && result.transactions).toHaveLength(TRANSACTION_SCAN_LIMIT);
  });

  it("上限を超えて返ってきたら打ち切りとして、余分に読んだ1件は表示に使わない", async () => {
    getDocs.mockResolvedValue({
      docs: Array.from({ length: TRANSACTION_SCAN_LIMIT + 1 }, (_, index) =>
        buildDocument(`id-${index}`),
      ),
    });

    const result = await fetchTransactions("all", NOW);

    expect(result).toMatchObject({ ok: true, truncated: true });
    expect(result.ok && result.transactions).toHaveLength(TRANSACTION_SCAN_LIMIT);
  });

  /** 1件の不整合で一覧全体を空にする方が情報が減る(`fetchAssetSnapshots`と同じ扱い) */
  it("形の違うドキュメントはその1件だけ飛ばす", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDocs.mockResolvedValue({
      docs: [buildDocument("aaaa1111"), buildDocument("bbbb2222", { amount: "-3200" })],
    });

    const result = await fetchTransactions("all", NOW);

    expect(result.ok && result.transactions.map((transaction) => transaction.id)).toEqual([
      "aaaa1111",
    ]);
  });

  it("取得に失敗したら理由を返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getDocs.mockRejectedValue(new Error("失敗"));

    const result = await fetchTransactions("1m", NOW);

    expect(result).toEqual({ ok: false, reason: "permission-denied" });
  });

  it("未ログインなら読みに行かない", async () => {
    resolveFirestoreUserContext.mockReturnValue({ ok: false, reason: "signed-out" });

    const result = await fetchTransactions("1m", NOW);

    expect(result).toEqual({ ok: false, reason: "signed-out" });
    expect(getDocs).not.toHaveBeenCalled();
  });
});
