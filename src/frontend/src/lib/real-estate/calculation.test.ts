import { describe, expect, it } from "vitest";

import { calculateRealEstateSpread, calculateRentalBalance } from "@/lib/real-estate/calculation";

const property = (marketValue: number, loanBalance: number): RealEstateProperty => ({
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  marketValue,
  loanBalance,
  updatedAt: "2026-06-01",
});

describe("calculateRealEstateSpread", () => {
  it("時価からローン残高を引いた額を返す", () => {
    expect(calculateRealEstateSpread(property(32_000_000, 18_400_000))).toBe(13_600_000);
  });

  it("ローンを完済した物件では時価がそのまま利ざやになる", () => {
    expect(calculateRealEstateSpread(property(18_000_000, 0))).toBe(18_000_000);
  });

  it("オーバーローン(残高が時価を上回る)の物件では負の値を返す", () => {
    expect(calculateRealEstateSpread(property(12_800_000, 14_100_000))).toBe(-1_300_000);
  });
});

describe("calculateRentalBalance", () => {
  it("賃貸収入から賃貸支出を引いた額を返す", () => {
    expect(calculateRentalBalance({ monthlyIncome: 128_000, monthlyExpense: 22_000 })).toBe(
      106_000,
    );
  });

  it("支出が収入を上回る月は負の値を返す", () => {
    expect(calculateRentalBalance({ monthlyIncome: 61_000, monthlyExpense: 74_500 })).toBe(-13_500);
  });
});
