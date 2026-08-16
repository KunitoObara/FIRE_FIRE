import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCashflowData } from "@/lib/dashboard/cashflow-data";

const fetchMonthlyTransactions = vi.fn();

vi.mock("@/lib/csv-import/transaction-repository", () => ({
  fetchMonthlyTransactions: (...args: unknown[]) => fetchMonthlyTransactions(...args),
}));

const buildTransaction = (transaction: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-08-05",
  content: "スーパー〇〇",
  amount: -3_280,
  account: "〇〇カード",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...transaction,
});

/**
 * 収支サマリの取得(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 * ダッシュボードの一括取得とは別に、対象の月ごとに読む。
 */
describe("fetchCashflowData", () => {
  beforeEach(() => {
    fetchMonthlyTransactions.mockReset();
    fetchMonthlyTransactions.mockResolvedValue({ ok: true, transactions: [], truncated: false });
  });

  it("渡された年月の取引を読む", async () => {
    await fetchCashflowData("2025-03");

    expect(fetchMonthlyTransactions).toHaveBeenCalledWith("2025-03");
  });

  it("読んだ取引から収支サマリを組み立てる", async () => {
    fetchMonthlyTransactions.mockResolvedValue({
      ok: true,
      truncated: false,
      transactions: [
        buildTransaction({ id: "a", amount: 420_000, categoryMajor: "収入" }),
        buildTransaction({ id: "b", amount: -98_000, categoryMajor: "住居費" }),
        buildTransaction({ id: "c", amount: -3_280, categoryMajor: "食費" }),
      ],
    });

    expect(await fetchCashflowData("2026-08")).toEqual({
      ok: true,
      cashflow: {
        month: "2026-08",
        income: 420_000,
        // 支出は絶対値で持つ(負のまま渡すと収支が`income + |支出|`になる)
        expense: 101_280,
        expenseByCategory: [
          { name: "住居費", amount: 98_000 },
          { name: "食費", amount: 3_280 },
        ],
      },
    });
  });

  /**
   * 読む範囲と集計する月に同じ値を使う。別々に決めると、月をまたぐ瞬間や表示中に日付が
   * 変わった場合に「先月の取引を今月として集計する」ずれが起きうる
   */
  it("集計した対象月は読んだ月と一致する", async () => {
    fetchMonthlyTransactions.mockResolvedValue({
      ok: true,
      truncated: false,
      transactions: [buildTransaction({ id: "a", date: "2025-03-04" })],
    });

    const result = await fetchCashflowData("2025-03");

    expect(result).toMatchObject({ ok: true, cashflow: { month: "2025-03" } });
  });

  /** 月初や取り込んでいない過去の月では正常に起こる。失敗としては扱わない */
  it("取引が1件も無ければ`cashflow: null`を成功として返す", async () => {
    expect(await fetchCashflowData("2026-08")).toEqual({ ok: true, cashflow: null });
  });

  /** 取得の失敗は空状態(データなし)と区別する。次にすべきことが正反対になる */
  it("取得に失敗したら理由付きで失敗を返す", async () => {
    fetchMonthlyTransactions.mockResolvedValue({ ok: false, reason: "permission-denied" });

    expect(await fetchCashflowData("2026-08")).toEqual({
      ok: false,
      reason: "permission-denied",
    });
  });
});
