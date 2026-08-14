import { describe, expect, it } from "vitest";

import {
  FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE,
  FIRE_GOAL_MONTHLY_CONTRIBUTION_TOO_LARGE_MESSAGE,
} from "@/constants/fire-goal";
import { fireGoalFormSchema } from "@/schemas/fire-goal";

/**
 * 毎月の積立額の検証(docs/screen-requirements-fire-goal.md B8「毎月の積立額」)。
 *
 * 他の金額欄と違い、マイナスと0を受け付ける一方で桁の上限は符号を除いて見る。境界と符号は
 * 画面操作より値そのもので確かめるほうが正確なので、フォームのテストとは別にここへ置く。
 */
describe("fireGoalFormSchema の毎月の積立額", () => {
  /** 積立額以外は「直接入力・目標額あり」で固定し、積立額だけを動かす */
  const parse = (monthlyContribution: string): string[] => {
    const result = fireGoalFormSchema.safeParse({
      mode: "direct",
      targetAmount: "80000000",
      annualExpense: "",
      withdrawalRate: "4",
      monthlyContribution,
    });

    return result.success
      ? []
      : result.error.issues
          .filter((issue) => issue.path[0] === "monthlyContribution")
          .map((issue) => issue.message);
  };

  /** 未入力は0(積立なし)として扱うので、必須にしない */
  it("未入力を通す", () => {
    expect(parse("")).toEqual([]);
  });

  it("プラス・マイナス・0のいずれも通す", () => {
    expect(parse("180000")).toEqual([]);
    expect(parse("-50000")).toEqual([]);
    expect(parse("0")).toEqual([]);
  });

  /** 上限は絶対値で見る(マイナス側にも同じ幅を持たせる) */
  it("符号を除いて12桁までを通す", () => {
    expect(parse("999999999999")).toEqual([]);
    expect(parse("-999999999999")).toEqual([]);
  });

  it("符号を除いて13桁は弾く", () => {
    expect(parse("1000000000000")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_TOO_LARGE_MESSAGE]);
    expect(parse("-1000000000000")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_TOO_LARGE_MESSAGE]);
  });

  /** マイナスを許す以外は他の金額欄と同じ形式(B7・B8の金額欄と揃える) */
  it("カンマ区切り・全角数字・小数・末尾のマイナスは弾く", () => {
    expect(parse("180,000")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE]);
    expect(parse("１８００００")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE]);
    expect(parse("1800.5")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE]);
    expect(parse("50000-")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE]);
  });

  /** `Number("1e5")`は100000になるため、形式で弾けていないと桁の判定も素通りする */
  it("指数表記は弾く", () => {
    expect(parse("1e5")).toEqual([FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE]);
  });
});
