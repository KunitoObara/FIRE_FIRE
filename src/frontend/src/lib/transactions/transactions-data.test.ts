import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTransactionsData } from "@/lib/transactions/transactions-data";

const fetchTransactions = vi.fn();

vi.mock("@/lib/csv-import/transaction-repository", () => ({
  fetchTransactions: (...args: unknown[]) => fetchTransactions(...args),
}));

const NOW = new Date("2026-07-30T12:00:00+09:00");

const buildTransaction = (transaction: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-07-20",
  content: "サンプル",
  amount: -1_000,
  account: "〇〇銀行",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...transaction,
});

const resolveTransactions = (transactions: Transaction[], truncated = false): void => {
  fetchTransactions.mockResolvedValue({ ok: true, transactions, truncated });
};

describe("fetchTransactionsData", () => {
  beforeEach(() => {
    fetchTransactions.mockReset();
    resolveTransactions([]);
  });

  it("選択中の期間をそのままリポジトリへ渡す", async () => {
    await fetchTransactionsData("3m", NOW);

    expect(fetchTransactions).toHaveBeenCalledWith("3m", NOW);
  });

  /** 費目マスタは持たないので、選択肢は取り込んだ取引そのものから作る(同書6章) */
  it("費目(大項目)と口座の選択肢を取引から組み立てる", async () => {
    resolveTransactions([
      buildTransaction({ id: "a", categoryMajor: "食費", account: "〇〇銀行" }),
      buildTransaction({ id: "b", categoryMajor: "住居費", account: "〇〇カード" }),
    ]);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toMatchObject({
      ok: true,
      data: { categories: ["住居費", "食費"], accounts: ["〇〇カード", "〇〇銀行"] },
    });
  });

  it("同じ費目・口座は選択肢に1度だけ出す", async () => {
    resolveTransactions([
      buildTransaction({ id: "a", categoryMajor: "食費", account: "〇〇銀行" }),
      buildTransaction({ id: "b", categoryMajor: "食費", account: "〇〇銀行" }),
    ]);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toMatchObject({
      ok: true,
      data: { categories: ["食費"], accounts: ["〇〇銀行"] },
    });
  });

  /** マネーフォワードが空で返しているものにアプリ側で名前を与えない(同書6章) */
  it("空の費目は選択肢に出さない", async () => {
    resolveTransactions([buildTransaction({ id: "a", categoryMajor: "" })]);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toMatchObject({ ok: true, data: { categories: [] } });
  });

  it("取引はそのままの並びで返す(並び替えは表示側の責務)", async () => {
    const transactions = [
      buildTransaction({ id: "a", date: "2026-07-20" }),
      buildTransaction({ id: "b", date: "2026-07-19" }),
    ];
    resolveTransactions(transactions);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result.ok && result.data.transactions).toEqual(transactions);
  });

  /** 打ち切りは画面に出す必要があるので、そのまま呼び出し側へ渡す(同書8章) */
  it("打ち切られたかどうかを引き継ぐ", async () => {
    resolveTransactions([buildTransaction({ id: "a" })], true);

    const result = await fetchTransactionsData("all", NOW);

    expect(result).toMatchObject({ ok: true, truncated: true });
  });

  it("1件も無ければ空の選択肢で返す", async () => {
    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toEqual({
      ok: true,
      truncated: false,
      data: { transactions: [], categories: [], categoryMinorsByMajor: {}, accounts: [] },
    });
  });

  /** 大項目を選ぶと中項目セレクタの選択肢がその配下に絞られる(同書6章) */
  it("中項目を大項目ごとに分けて返す", async () => {
    resolveTransactions([
      buildTransaction({ id: "a", categoryMajor: "食費", categoryMinor: "食料品" }),
      buildTransaction({ id: "b", categoryMajor: "食費", categoryMinor: "外食" }),
      buildTransaction({ id: "c", categoryMajor: "住居費", categoryMinor: "家賃" }),
    ]);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toMatchObject({
      ok: true,
      data: { categoryMinorsByMajor: { 食費: ["外食", "食料品"], 住居費: ["家賃"] } },
    });
  });

  it("中項目が空の取引は中項目の選択肢に出さない", async () => {
    resolveTransactions([
      buildTransaction({ id: "a", categoryMajor: "食費", categoryMinor: "" }),
      buildTransaction({ id: "b", categoryMajor: "食費", categoryMinor: "外食" }),
    ]);

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toMatchObject({ ok: true, data: { categoryMinorsByMajor: { 食費: ["外食"] } } });
  });

  /** 取得の失敗を空状態(未取込)にすり替えない */
  it("取得に失敗したら理由をそのまま返す", async () => {
    fetchTransactions.mockResolvedValue({ ok: false, reason: "permission-denied" });

    const result = await fetchTransactionsData("1m", NOW);

    expect(result).toEqual({ ok: false, reason: "permission-denied" });
  });
});
