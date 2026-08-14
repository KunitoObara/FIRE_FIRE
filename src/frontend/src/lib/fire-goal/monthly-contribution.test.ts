import { describe, expect, it } from "vitest";

import {
  resolveContributionSourceMonth,
  resolveMonthlyContributionPrefill,
} from "@/lib/fire-goal/monthly-contribution";

/** 収支サマリ1件分。費目別支出は初期値の算出に関係しないので空にしておく */
const cashflow = (income: number, expense: number): CashflowSummary => ({
  month: "2026-07",
  income,
  expense,
  expenseByCategory: [],
});

describe("resolveContributionSourceMonth", () => {
  /** 当月は月初だと数日分しか無く、その月の収支として意味を成さない(要件B8) */
  it("当月ではなく前月を返す", () => {
    expect(resolveContributionSourceMonth(new Date(2026, 7, 14))).toBe("2026-07");
  });

  it("1月なら前年の12月を返す", () => {
    expect(resolveContributionSourceMonth(new Date(2026, 0, 5))).toBe("2025-12");
  });
});

describe("resolveMonthlyContributionPrefill", () => {
  it("前月の収支(収入 − 支出)を初期値にする", () => {
    const prefill = resolveMonthlyContributionPrefill(
      { ok: true, cashflow: cashflow(500_000, 320_000) },
      "2026-07",
    );

    expect(prefill.amount).toBe(180_000);
    expect(prefill.notice).toBe("初期値には前月(2026年7月)の収支(収入 − 支出)を入れています。");
  });

  /** 支出が収入を上回った月。符号を落とすと取り崩しが積立に化ける */
  it("支出が収入を上回った月はマイナスのまま初期値にする", () => {
    expect(
      resolveMonthlyContributionPrefill(
        { ok: true, cashflow: cashflow(200_000, 320_000) },
        "2026-07",
      ).amount,
    ).toBe(-120_000);
  });

  /** 0円を提示すると「収支がちょうど0だった」と読める(要件B8) */
  it("前月の取引が0件なら初期値を提示せず、その旨を添える", () => {
    const prefill = resolveMonthlyContributionPrefill({ ok: true, cashflow: null }, "2026-07");

    expect(prefill.amount).toBeNull();
    expect(prefill.notice).toBe("前月(2026年7月)の取引が無いため、初期値は提示していません。");
  });

  /** 取込の有無ではなく読み込みの問題なので、0件とは次にすべきことが違う */
  it("取得に失敗した場合は0件とは別の文言を添える", () => {
    const prefill = resolveMonthlyContributionPrefill(
      { ok: false, reason: "permission-denied" },
      "2026-07",
    );

    expect(prefill.amount).toBeNull();
    expect(prefill.notice).toBe(
      "前月(2026年7月)の収支を取得できなかったため、初期値は提示していません。",
    );
  });

  /** 取得前は失敗ではないので、注記も出さない(呼び出し側は取得を待ってから出す) */
  it("取得前は金額も注記も返さない", () => {
    expect(resolveMonthlyContributionPrefill(undefined, "2026-07")).toEqual({
      amount: null,
      notice: null,
    });
  });
});
