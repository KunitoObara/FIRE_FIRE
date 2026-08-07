import { describe, expect, it } from "vitest";

import { FIRE_GOAL_AMOUNT_PATTERN } from "@/constants/fire-goal";
import { toFireGoal, toFireGoalFormValues, toPreviewNumber } from "@/lib/fire-goal/form-values";

describe("toFireGoal", () => {
  /** 方式を切り替えて保存し直しても反対側の入力が消えないことが、この保存範囲の狙い */
  it("有効な方式の欄だけでなく、非表示タブの入力値も保存する", () => {
    expect(
      toFireGoal({
        mode: "direct",
        targetAmount: "80000000",
        annualExpense: "3600000",
        withdrawalRate: "4",
      }),
    ).toEqual({
      mode: "direct",
      targetAmount: 80_000_000,
      annualExpense: 3_600_000,
      withdrawalRate: 4,
    });
  });

  it("未入力の欄はnullにする", () => {
    expect(
      toFireGoal({
        mode: "direct",
        targetAmount: "80000000",
        annualExpense: "",
        withdrawalRate: "",
      }),
    ).toEqual({
      mode: "direct",
      targetAmount: 80_000_000,
      annualExpense: null,
      withdrawalRate: null,
    });
  });

  /** `Number("")`の0や`Number("abc")`のNaNが金額としてFirestoreに入らないことの確認 */
  it("数値として解釈できない値は0やNaNにせずnullにする", () => {
    expect(
      toFireGoal({
        mode: "reverse",
        targetAmount: "８０００",
        annualExpense: "3600000",
        withdrawalRate: "4",
      }).targetAmount,
    ).toBeNull();
  });

  it("小数の逆算係数はそのまま保存する", () => {
    expect(
      toFireGoal({
        mode: "reverse",
        targetAmount: "",
        annualExpense: "3600000",
        withdrawalRate: "3.5",
      }).withdrawalRate,
    ).toBe(3.5);
  });
});

describe("toFireGoalFormValues", () => {
  it("未設定なら直接入力タブと既定の逆算係数から始める", () => {
    expect(toFireGoalFormValues(null)).toEqual({
      mode: "direct",
      targetAmount: "",
      annualExpense: "",
      withdrawalRate: "4",
    });
  });

  it("保存済みの値を両タブとも復元する", () => {
    expect(
      toFireGoalFormValues({
        mode: "reverse",
        targetAmount: 80_000_000,
        annualExpense: 3_600_000,
        withdrawalRate: 3.5,
      }),
    ).toEqual({
      mode: "reverse",
      targetAmount: "80000000",
      annualExpense: "3600000",
      withdrawalRate: "3.5",
    });
  });

  it("保存されていない金額欄は空欄にする", () => {
    expect(
      toFireGoalFormValues({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: 4,
      }).annualExpense,
    ).toBe("");
  });

  /** 「デフォルト値ありで編集可能」な欄なので、空欄から始めさせない */
  it("逆算係数だけは未保存でも既定値を入れる", () => {
    expect(
      toFireGoalFormValues({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
      }).withdrawalRate,
    ).toBe("4");
  });
});

describe("toPreviewNumber", () => {
  it("形式に合う入力は数値にする", () => {
    expect(toPreviewNumber("80000000", FIRE_GOAL_AMOUNT_PATTERN)).toBe(80_000_000);
  });

  it("入力途中の空文字では算出しない", () => {
    expect(toPreviewNumber("", FIRE_GOAL_AMOUNT_PATTERN)).toBeNull();
  });

  it("形式に合わない入力では算出しない", () => {
    expect(toPreviewNumber("80,000,000", FIRE_GOAL_AMOUNT_PATTERN)).toBeNull();
  });
});
