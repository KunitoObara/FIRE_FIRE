import { describe, expect, it } from "vitest";

import {
  resolveTransactionDateRange,
  resolveTransactionMonthRange,
} from "@/lib/transactions/period";

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

describe("resolveTransactionMonthRange", () => {
  it("指定した年月の1日から月末までを範囲にする", () => {
    expect(resolveTransactionMonthRange("2026-08")).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  /**
   * B1の収支サマリは「その月の収支」を出すカードなので、当月を選んでいる場合は今日より後の
   * 日付が付いた取引もその月のものとして数える(B3の「直近1ヶ月」が今日で閉じるのとは扱いが違う)
   */
  it("今日ではなく月末までを含める", () => {
    expect(resolveTransactionMonthRange("2026-02").to).toBe("2026-02-28");
  });

  it("月末の日数が月ごとに違っても取り違えない", () => {
    expect(resolveTransactionMonthRange("2026-09")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  /**
   * 対象の月は画面上で選べる(docs/screen-requirements-dashboard.md B1「年月の選択」)。
   * 当月を前提にした実装が残っていると、過去の月を選んでも当月の範囲を読んでしまう
   */
  it("過去の月でもその月の範囲になる(当月に寄らない)", () => {
    expect(resolveTransactionMonthRange("2025-03")).toEqual({
      from: "2025-03-01",
      to: "2025-03-31",
    });
  });

  /** うるう年の2月を28日で閉じると、29日の取引が1件欠ける */
  it("うるう年の2月は29日まで含める", () => {
    expect(resolveTransactionMonthRange("2028-02").to).toBe("2028-02-29");
  });
});
