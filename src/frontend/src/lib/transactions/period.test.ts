import { describe, expect, it } from "vitest";

import { resolveTransactionDateRange } from "@/lib/transactions/period";

const NOW = new Date("2026-07-31T00:00:00.000Z");

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
   * 境界の取引を落とすと、期間を切り替えたときに直近の取引が1件欠ける。
   * Firestoreの範囲は`>=`で比較されるので、この日付ちょうどの取引は読める
   */
  it("ちょうどNヶ月前の日付を境界に含める", () => {
    expect(resolveTransactionDateRange("1m", NOW).from).toBe("2026-06-30");
  });
});
