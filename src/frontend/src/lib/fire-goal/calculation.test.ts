import { describe, expect, it } from "vitest";

import {
  calculateTargetFromAnnualExpense,
  resolveFireGoalTargetAmount,
} from "@/lib/fire-goal/calculation";

const goal = (overrides: Partial<FireGoal>): FireGoal => ({
  mode: "direct",
  targetAmount: 80_000_000,
  annualExpense: 3_600_000,
  withdrawalRate: 4,
  ...overrides,
});

describe("calculateTargetFromAnnualExpense", () => {
  /** HTMLモック b8-fire-goal.html と同じ入力・同じ結果になることを確かめる */
  it("4%ルールでは年間支出額の25倍になる", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, 4)).toBe(90_000_000);
  });

  /** 要件定義書 4.6 が例に挙げる4%ルール(年間支出300万円 → 7,500万円) */
  it("年間支出300万円・4%ルールなら7,500万円になる", () => {
    expect(calculateTargetFromAnnualExpense(3_000_000, 4)).toBe(75_000_000);
  });

  it("係数を上げると必要な目標資産額は小さくなる", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, 5)).toBe(72_000_000);
  });

  /** 月率(年率 ÷ 12)と取り違えていれば12倍ずれた値になって落ちる */
  it("係数は年率として扱う(月率に読み替えない)", () => {
    expect(calculateTargetFromAnnualExpense(1_200_000, 4)).toBe(30_000_000);
  });

  it("年間支出額が0なら目標資産額も0になる", () => {
    expect(calculateTargetFromAnnualExpense(0, 4)).toBe(0);
  });

  it("小数の係数も扱える", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, 3.5)).toBe(102_857_143);
  });

  /** パーセントを比率(0.04)と取り違えていれば、100倍ずれた値になって落ちる */
  it("係数100%なら年間支出額と同額になる", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, 100)).toBe(3_600_000);
  });

  it("円未満は四捨五入する", () => {
    expect(calculateTargetFromAnnualExpense(1_000_000, 3)).toBe(33_333_333);
  });

  it("係数が0なら算出できないものとして扱う", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, 0)).toBeNull();
  });

  it("係数が負なら算出できないものとして扱う", () => {
    expect(calculateTargetFromAnnualExpense(3_600_000, -4)).toBeNull();
  });
});

describe("resolveFireGoalTargetAmount", () => {
  it("直接入力では入力された目標資産額をそのまま返す", () => {
    expect(resolveFireGoalTargetAmount(goal({ mode: "direct" }))).toBe(80_000_000);
  });

  /** 逆算タブに切り替えたら、直接入力側に残っている値ではなく逆算の結果が使われる */
  it("逆算では年間支出額と係数から算出した額を返す", () => {
    expect(resolveFireGoalTargetAmount(goal({ mode: "reverse" }))).toBe(90_000_000);
  });

  it("直接入力で目標資産額が未入力なら算出できない", () => {
    expect(resolveFireGoalTargetAmount(goal({ mode: "direct", targetAmount: null }))).toBeNull();
  });

  it("逆算で年間支出額が未入力なら算出できない", () => {
    expect(resolveFireGoalTargetAmount(goal({ mode: "reverse", annualExpense: null }))).toBeNull();
  });

  it("逆算で係数が未入力なら算出できない", () => {
    expect(resolveFireGoalTargetAmount(goal({ mode: "reverse", withdrawalRate: null }))).toBeNull();
  });
});
