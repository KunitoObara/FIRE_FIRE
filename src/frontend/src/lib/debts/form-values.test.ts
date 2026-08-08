import { describe, expect, it } from "vitest";

import {
  buildEmptyDebtRow,
  toDebtInput,
  toDebtRowFormValues,
  toRepaymentMonths,
} from "@/lib/debts/form-values";

const savedDebt: Debt = {
  id: "debt-1",
  name: "住宅ローン(〇〇銀行)",
  balance: 18_400_000,
  interestRate: 0.475,
  repaymentMonths: 280,
  updatedAt: "2026-07-12",
  balanceHistory: { "2026-07-12": 18_400_000 },
};

describe("toRepaymentMonths", () => {
  it("年とヶ月を総月数へ正規化する", () => {
    expect(toRepaymentMonths("23", "4")).toBe(280);
  });

  /** B11-3 ケース2の決定。空欄側を0として扱い、エラーにはしない */
  it("年だけ入力されていれば、ヶ月を0として扱う", () => {
    expect(toRepaymentMonths("5", "")).toBe(60);
  });

  it("ヶ月だけ入力されていれば、年を0として扱う", () => {
    expect(toRepaymentMonths("", "4")).toBe(4);
  });

  /** 両方空のときだけ未登録。0ヶ月(=総月数0)と区別する */
  it("両方が空欄のときだけ未登録(null)にする", () => {
    expect(toRepaymentMonths("", "")).toBeNull();
  });

  it("0年0ヶ月は未登録ではなく総月数0として扱う", () => {
    expect(toRepaymentMonths("0", "0")).toBe(0);
  });
});

describe("toDebtRowFormValues", () => {
  it("総月数を年・ヶ月の2欄へ割り戻す", () => {
    expect(toDebtRowFormValues(savedDebt)).toEqual({
      id: "debt-1",
      name: "住宅ローン(〇〇銀行)",
      balance: "18400000",
      interestRate: "0.475",
      repaymentYears: "23",
      repaymentMonths: "4",
      updatedAt: "2026-07-12",
    });
  });

  /** 未登録は0%・0ヶ月ではなく空欄で出す(B11「入力項目の補足」) */
  it("金利・返済期間が未登録なら欄を空にする", () => {
    const row = toDebtRowFormValues({ ...savedDebt, interestRate: null, repaymentMonths: null });

    expect(row.interestRate).toBe("");
    expect(row.repaymentYears).toBe("");
    expect(row.repaymentMonths).toBe("");
  });

  it("総月数0は未登録ではなく0年0ヶ月として出す", () => {
    const row = toDebtRowFormValues({ ...savedDebt, repaymentMonths: 0 });

    expect(row.repaymentYears).toBe("0");
    expect(row.repaymentMonths).toBe("0");
  });

  /** 0%も正当な値なので空欄に潰さない */
  it("金利0は空欄にせず0のまま出す", () => {
    expect(toDebtRowFormValues({ ...savedDebt, interestRate: 0 }).interestRate).toBe("0");
  });
});

describe("toDebtInput", () => {
  it("入力値を保存する形へ変換する", () => {
    expect(toDebtInput(toDebtRowFormValues(savedDebt))).toEqual({
      id: "debt-1",
      name: "住宅ローン(〇〇銀行)",
      balance: 18_400_000,
      interestRate: 0.475,
      repaymentMonths: 280,
    });
  });

  /** 画面上で追加しただけの行は採番前なのでidを持たない */
  it("追加しただけの行はidがnullのまま渡る", () => {
    expect(
      toDebtInput({ ...buildEmptyDebtRow(), name: " カードローン ", balance: "450000" }),
    ).toEqual({
      id: null,
      name: "カードローン",
      balance: 450_000,
      interestRate: null,
      repaymentMonths: null,
    });
  });
});
