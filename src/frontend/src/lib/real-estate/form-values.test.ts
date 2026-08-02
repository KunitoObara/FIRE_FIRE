import { describe, expect, it } from "vitest";

import { toRealEstateFormValues, toRealEstatePropertyInput } from "@/lib/real-estate/form-values";

const RENTAL_PROPERTY: RealEstateProperty = {
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
  updatedAt: "2026-06-01",
};

const OWNED_HOUSE: RealEstateProperty = {
  id: "chiba-house",
  name: "□□戸建て",
  location: "",
  marketValue: 18_000_000,
  loanBalance: 0,
  updatedAt: "2026-04-02",
};

describe("toRealEstatePropertyInput", () => {
  it("金額を数値に変換する", () => {
    expect(
      toRealEstatePropertyInput({
        name: "〇〇マンション101号室",
        location: "東京都渋谷区神南1-2-3",
        marketValue: "32000000",
        loanBalance: "18400000",
        isRentalProperty: true,
        rentalMonthlyIncome: "128000",
        rentalMonthlyExpense: "22000",
      }),
    ).toEqual({
      name: "〇〇マンション101号室",
      location: "東京都渋谷区神南1-2-3",
      marketValue: 32_000_000,
      loanBalance: 18_400_000,
      rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
    });
  });

  /**
   * 「収益物件として登録」をオフにして保存した場合、賃貸収入/支出は保持しない
   * (docs/screen-requirements-real-estate.md B7)。入力欄に値が残っていても捨てる。
   */
  it("収益物件でない場合は、入力欄に残った賃貸収入/支出を保存しない", () => {
    const input = toRealEstatePropertyInput({
      name: "□□戸建て",
      location: "",
      marketValue: "18000000",
      loanBalance: "0",
      isRentalProperty: false,
      rentalMonthlyIncome: "61000",
      rentalMonthlyExpense: "74500",
    });

    expect(input.rental).toBeNull();
  });
});

describe("toRealEstateFormValues", () => {
  it("収益物件は賃貸の入力欄に既存の値を入れ、チェックをオンにする", () => {
    expect(toRealEstateFormValues(RENTAL_PROPERTY)).toEqual({
      name: "〇〇マンション101号室",
      location: "東京都渋谷区神南1-2-3",
      marketValue: "32000000",
      loanBalance: "18400000",
      isRentalProperty: true,
      rentalMonthlyIncome: "128000",
      rentalMonthlyExpense: "22000",
    });
  });

  it("収益物件でない物件はチェックをオフにし、賃貸の入力欄を空にする", () => {
    expect(toRealEstateFormValues(OWNED_HOUSE)).toEqual({
      name: "□□戸建て",
      location: "",
      marketValue: "18000000",
      // ローン完済済みの物件は「0」が入る(空欄ではない)
      loanBalance: "0",
      isRentalProperty: false,
      rentalMonthlyIncome: "",
      rentalMonthlyExpense: "",
    });
  });
});
