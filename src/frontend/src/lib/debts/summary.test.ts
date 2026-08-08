import { describe, expect, it } from "vitest";

import {
  formatDebtInterestRate,
  formatRepaymentPeriod,
  resolveLatestUpdatedAt,
  sortDebtsByBalance,
} from "@/lib/debts/summary";

const buildDebt = (overrides: Partial<Debt>): Debt => ({
  id: "debt-1",
  name: "住宅ローン",
  balance: 1_000_000,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-07-12",
  balanceHistory: {},
  ...overrides,
});

describe("sortDebtsByBalance", () => {
  it("残債の多い順に並べる(登録順ではなく金額順)", () => {
    const debts = [
      buildDebt({ id: "a", balance: 1_230_000 }),
      buildDebt({ id: "b", balance: 18_400_000 }),
      buildDebt({ id: "c", balance: 2_300_000 }),
    ];

    expect(sortDebtsByBalance(debts).map((debt) => debt.id)).toEqual(["b", "c", "a"]);
  });

  /** 合計にも同じ配列を使うため、表示の都合で並びを壊さない */
  it("引数の配列は並べ替えない", () => {
    const debts = [buildDebt({ id: "a", balance: 1 }), buildDebt({ id: "b", balance: 2 })];

    sortDebtsByBalance(debts);

    expect(debts.map((debt) => debt.id)).toEqual(["a", "b"]);
  });
});

describe("formatDebtInterestRate", () => {
  it("金利を%付きで出す", () => {
    expect(formatDebtInterestRate(0.475)).toBe("0.475%");
  });

  /** 未登録と0%を区別する(B1「負債サマリ」) */
  it("未登録は空文字にする", () => {
    expect(formatDebtInterestRate(null)).toBe("");
  });

  it("0%は空欄にせず0%と出す", () => {
    expect(formatDebtInterestRate(0)).toBe("0%");
  });
});

describe("formatRepaymentPeriod", () => {
  it("総月数を◯年◯ヶ月に組み立て直す", () => {
    expect(formatRepaymentPeriod(280)).toBe("23年4ヶ月");
  });

  it("ちょうど年単位なら月を省く", () => {
    expect(formatRepaymentPeriod(60)).toBe("5年");
  });

  it("1年未満なら年を省く", () => {
    expect(formatRepaymentPeriod(4)).toBe("4ヶ月");
  });

  /** 未登録と0ヶ月を区別する */
  it("未登録は空文字にする", () => {
    expect(formatRepaymentPeriod(null)).toBe("");
  });

  it("総月数0は0ヶ月として出す", () => {
    expect(formatRepaymentPeriod(0)).toBe("0ヶ月");
  });
});

describe("resolveLatestUpdatedAt", () => {
  it("いちばん新しい保存日を返す", () => {
    expect(
      resolveLatestUpdatedAt([
        buildDebt({ id: "a", updatedAt: "2026-05-02" }),
        buildDebt({ id: "b", updatedAt: "2026-07-12" }),
        buildDebt({ id: "c", updatedAt: "2026-06-30" }),
      ]),
    ).toBe("2026-07-12");
  });

  it("1件も無ければnullを返す", () => {
    expect(resolveLatestUpdatedAt([])).toBeNull();
  });
});
