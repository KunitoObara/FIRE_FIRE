import { describe, expect, it } from "vitest";

import { resolveCategoryAxisDebtReferences } from "@/lib/asset-categories/debt-references";

const buildDebt = (id: string): Debt => ({
  id,
  name: `負債 ${id}`,
  balance: 1_000_000,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-07-12",
  balanceHistory: {},
});

const readyOptions = (ids: string[]): DebtOptionsState => ({
  status: "ready",
  debts: ids.map(buildDebt),
});

describe("resolveCategoryAxisDebtReferences", () => {
  it("B11に残っている参照と削除済みの件数を分けて返す", () => {
    expect(
      resolveCategoryAxisDebtReferences(
        ["debt-a", "debt-deleted", "debt-b"],
        readyOptions(["debt-a", "debt-b"]),
      ),
    ).toEqual({ activeIds: ["debt-a", "debt-b"], missingCount: 1 });
  });

  it("すべての参照が削除済みでも、残り0件と削除済みの件数を返す", () => {
    expect(resolveCategoryAxisDebtReferences(["debt-deleted"], readyOptions(["debt-a"]))).toEqual({
      activeIds: [],
      missingCount: 1,
    });
  });

  it("参照が1つも無ければ削除済みも0件", () => {
    expect(resolveCategoryAxisDebtReferences([], readyOptions(["debt-a"]))).toEqual({
      activeIds: [],
      missingCount: 0,
    });
  });

  /*
    登録済みの負債が分からない状態では削除済みかどうかを判定できない。ここで空配列や
    0件に倒すと、「取得に失敗しただけ」が「削除された」として画面に出る(B4)
  */
  it("負債の選択肢を読み込み中は判定しない", () => {
    expect(resolveCategoryAxisDebtReferences(["debt-a"], { status: "loading" })).toBeNull();
  });

  it("負債の選択肢の取得に失敗した場合も判定しない", () => {
    expect(
      resolveCategoryAxisDebtReferences(["debt-a"], { status: "error", message: "取得できません" }),
    ).toBeNull();
  });
});
