import { describe, expect, it } from "vitest";

import {
  buildDebtDeletionPreviews,
  collectAffectedAxisNames,
  sumDebtFormBalances,
} from "@/lib/debts/form-summary";
import { buildEmptyDebtRow, toDebtRowFormValues } from "@/lib/debts/form-values";

const buildDebt = (overrides: Partial<Debt>): Debt => ({
  id: "debt-1",
  name: "住宅ローン",
  balance: 18_400_000,
  originatedOn: null,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-07-12",
  balanceHistory: {},
  ...overrides,
});

const buildAxis = (overrides: Partial<AssetCategoryAxisDocument>): AssetCategoryAxisDocument => ({
  id: "axis-1",
  name: "純金融資産",
  assetTypeNames: [],
  debtIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("sumDebtFormBalances", () => {
  it("入力中の残債を合計する", () => {
    expect(
      sumDebtFormBalances([
        { ...buildEmptyDebtRow(), balance: "18400000" },
        { ...buildEmptyDebtRow(), balance: "1230000" },
      ]),
    ).toBe(19_630_000);
  });

  /** 読めない値を0円として黙って足すと、合計が実態とずれたまま画面に出る */
  it("形式エラーの行は合計に入れない", () => {
    expect(
      sumDebtFormBalances([
        { ...buildEmptyDebtRow(), balance: "450,000" },
        { ...buildEmptyDebtRow(), balance: "1230000" },
      ]),
    ).toBe(1_230_000);
  });

  it("未入力の行も合計に入れない", () => {
    expect(sumDebtFormBalances([buildEmptyDebtRow()])).toBe(0);
  });
});

describe("buildDebtDeletionPreviews", () => {
  const saved = [
    buildDebt({ id: "debt-1", name: "カードローン", balance: 450_000 }),
    buildDebt({ id: "debt-2", name: "カードローン", balance: 1_230_000 }),
  ];

  it("フォームの行に残っていない保存済みの負債を削除対象として返す", () => {
    const values: DebtFormValues = { debts: [toDebtRowFormValues(saved[1] as Debt)] };

    expect(buildDebtDeletionPreviews(saved, values)).toEqual([
      { id: "debt-1", name: "カードローン", balance: "¥ 450,000" },
    ]);
  });

  /** 項目名の重複を許すため、名前だけではどちらが消えるのか確認できない */
  it("同名の負債は残債額で見分けられる形にする", () => {
    const previews = buildDebtDeletionPreviews(saved, { debts: [] });

    expect(previews.map((preview) => preview.balance)).toEqual(["¥ 450,000", "¥ 1,230,000"]);
  });

  it("追加しただけの行があっても削除対象にはならない", () => {
    const values: DebtFormValues = {
      debts: [...saved.map(toDebtRowFormValues), buildEmptyDebtRow()],
    };

    expect(buildDebtDeletionPreviews(saved, values)).toEqual([]);
  });
});

describe("collectAffectedAxisNames", () => {
  const deletions = [
    { id: "debt-1", name: "カードローン", balance: "¥ 450,000" },
    { id: "debt-2", name: "自動車ローン", balance: "¥ 1,230,000" },
  ];

  /** B11-3 ケース3の決定。件数ではなく該当する軸をすべて出す */
  it("削除対象を集計対象にしている分類軸をすべて返す", () => {
    const axes = [
      buildAxis({ id: "axis-1", name: "純金融資産", debtIds: ["debt-1"] }),
      buildAxis({ id: "axis-2", name: "投資性資産", debtIds: ["debt-2"] }),
      buildAxis({ id: "axis-3", name: "総資産", debtIds: [] }),
    ];

    expect(collectAffectedAxisNames(axes, deletions)).toEqual(["純金融資産", "投資性資産"]);
  });

  it("1つの軸が複数の削除対象を参照していても名前は1度だけ出す", () => {
    const axes = [buildAxis({ id: "axis-1", name: "純金融資産", debtIds: ["debt-1", "debt-2"] })];

    expect(collectAffectedAxisNames(axes, deletions)).toEqual(["純金融資産"]);
  });

  it("どの軸も参照していなければ空を返す", () => {
    expect(collectAffectedAxisNames([buildAxis({ debtIds: ["debt-9"] })], deletions)).toEqual([]);
  });
});
