import { describe, expect, it } from "vitest";

import { filterTransactionsByPeriod, resolveTransactionDateRange } from "@/lib/transactions/period";

const NOW = new Date("2026-07-31T00:00:00.000Z");

const buildTransaction = (id: string, date: string): Transaction => ({
  id,
  date,
  category: "食費",
  account: "楽天カード",
  amount: -1_000,
  description: "テスト",
});

const transactions: Transaction[] = [
  buildTransaction("a", "2025-01-15"),
  buildTransaction("b", "2026-01-01"),
  buildTransaction("c", "2026-05-01"),
  buildTransaction("d", "2026-06-30"),
  buildTransaction("e", "2026-07-31"),
];

const idsOf = (result: Transaction[]): string[] => result.map((transaction) => transaction.id);

describe("filterTransactionsByPeriod", () => {
  it("直近1ヶ月を選ぶとちょうど1ヶ月前以降だけを残す", () => {
    expect(idsOf(filterTransactionsByPeriod(transactions, "1m", NOW))).toEqual(["d", "e"]);
  });

  it("直近3ヶ月を選ぶとちょうど3ヶ月前以降だけを残す", () => {
    expect(idsOf(filterTransactionsByPeriod(transactions, "3m", NOW))).toEqual(["c", "d", "e"]);
  });

  it("今年を選ぶと当年1/1以降だけを残す", () => {
    expect(idsOf(filterTransactionsByPeriod(transactions, "this-year", NOW))).toEqual([
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("全期間は絞り込まない", () => {
    expect(idsOf(filterTransactionsByPeriod(transactions, "all", NOW))).toEqual(
      idsOf(transactions),
    );
  });

  /** 境界の取引を落とすと、期間を切り替えたときに直近の取引が1件欠ける */
  it("ちょうどN ヶ月前の取引は含める", () => {
    const boundary = [buildTransaction("boundary", "2026-06-30")];

    expect(filterTransactionsByPeriod(boundary, "1m", NOW)).toHaveLength(1);
  });

  it("N ヶ月前より1日でも古い取引は含めない", () => {
    const justOutside = [buildTransaction("outside", "2026-06-29")];

    expect(filterTransactionsByPeriod(justOutside, "1m", NOW)).toHaveLength(0);
  });

  it("データが無ければ空のまま返す", () => {
    expect(filterTransactionsByPeriod([], "all", NOW)).toEqual([]);
  });
});

describe("resolveTransactionDateRange", () => {
  it.each([
    ["1m", "2026-06-30"],
    ["3m", "2026-04-30"],
    ["this-year", "2026-01-01"],
  ] as const)("%s は %s 以降を今日まで読む", (periodId, from) => {
    expect(resolveTransactionDateRange(periodId, NOW)).toEqual({ from, to: "2026-07-31" });
  });

  /** 境界を持たないので条件そのものを付けない。`null`を`where`に渡すと日付として比較される */
  it("全期間は境界を持たない", () => {
    expect(resolveTransactionDateRange("all", NOW)).toEqual({ from: null, to: null });
  });

  /**
   * 範囲クエリで読む境界と、クライアント側で絞り込む境界が食い違うと、読めているのに
   * 表示から落ちる(またはその逆)取引が出る。両者は同じ関数から境界を決めている
   */
  it("クライアント側の期間絞り込みと同じ境界になる", () => {
    const range = resolveTransactionDateRange("1m", NOW);
    const boundary = [buildTransaction("boundary", range.from ?? "")];

    expect(filterTransactionsByPeriod(boundary, "1m", NOW)).toHaveLength(1);
  });
});
