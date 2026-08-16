import { describe, expect, it } from "vitest";

import { FIRE_GOAL_AMOUNT_PATTERN } from "@/constants/fire-goal";
import { toFireGoal, toFireGoalFormValues, toPreviewNumber } from "@/lib/fire-goal/form-values";

describe("toFireGoal", () => {
  /** 方式を切り替えて保存し直しても反対側の入力が消えないことが、この保存範囲の狙い */
  it("有効な方式の欄だけでなく、非表示タブの入力値も保存する", () => {
    expect(
      toFireGoal(
        {
          mode: "direct",
          targetAmount: "80000000",
          annualExpense: "3600000",
          withdrawalRate: "4",
          monthlyContribution: "180000",
        },
        null,
      ),
    ).toEqual({
      mode: "direct",
      targetAmount: 80_000_000,
      annualExpense: 3_600_000,
      withdrawalRate: 4,
      achievementAxisId: null,
      monthlyContribution: 180_000,
    });
  });

  it("未入力の欄はnullにする", () => {
    expect(
      toFireGoal(
        {
          mode: "direct",
          targetAmount: "80000000",
          annualExpense: "",
          withdrawalRate: "",
          monthlyContribution: "",
        },
        null,
      ),
    ).toEqual({
      mode: "direct",
      targetAmount: 80_000_000,
      annualExpense: null,
      withdrawalRate: null,
      achievementAxisId: null,
      // 積立額だけは未入力もnullにしない(下のテスト)
      monthlyContribution: 0,
    });
  });

  /**
   * `null`のまま保存すると、次にB8を開いたときに前月の収支がまた初期値として提示され、
   * 意図して空にした設定が次の保存で化ける(要件B8「未入力は0(積立なし)として扱う」)。
   */
  it("積立額だけは未入力を0として保存する", () => {
    expect(
      toFireGoal(
        {
          mode: "direct",
          targetAmount: "80000000",
          annualExpense: "",
          withdrawalRate: "",
          monthlyContribution: "",
        },
        null,
      ).monthlyContribution,
    ).toBe(0);
  });

  /** 取り崩しの局面を表せるようにするため、積立額だけはマイナスを受け付ける(要件B8) */
  it("マイナスの積立額は符号を落とさずに保存する", () => {
    expect(
      toFireGoal(
        {
          mode: "direct",
          targetAmount: "80000000",
          annualExpense: "",
          withdrawalRate: "",
          monthlyContribution: "-50000",
        },
        null,
      ).monthlyContribution,
    ).toBe(-50_000);
  });

  /** 「積立なし」は正当な設定なので、0を未入力(null)に倒さない */
  it("0の積立額はそのまま0で保存する", () => {
    expect(
      toFireGoal(
        {
          mode: "direct",
          targetAmount: "80000000",
          annualExpense: "",
          withdrawalRate: "",
          monthlyContribution: "0",
        },
        null,
      ).monthlyContribution,
    ).toBe(0);
  });

  /** `Number("")`の0や`Number("abc")`のNaNが金額としてFirestoreに入らないことの確認 */
  it("数値として解釈できない値は0やNaNにせずnullにする", () => {
    expect(
      toFireGoal(
        {
          mode: "reverse",
          targetAmount: "８０００",
          annualExpense: "3600000",
          withdrawalRate: "4",
          monthlyContribution: "180000",
        },
        null,
      ).targetAmount,
    ).toBeNull();
  });

  it("小数の逆算係数はそのまま保存する", () => {
    expect(
      toFireGoal(
        {
          mode: "reverse",
          targetAmount: "",
          annualExpense: "3600000",
          withdrawalRate: "3.5",
          monthlyContribution: "",
        },
        null,
      ).withdrawalRate,
    ).toBe(3.5);
  });
});

describe("toFireGoalFormValues", () => {
  /** 保存済みの目標(積立額だけを差し替えて使う) */
  const savedGoal: FireGoal = {
    mode: "reverse",
    targetAmount: 80_000_000,
    annualExpense: 3_600_000,
    withdrawalRate: 3.5,
    achievementAxisId: null,
    monthlyContribution: 200_000,
  };

  it("未設定なら直接入力タブと既定の逆算係数から始める", () => {
    expect(toFireGoalFormValues(null, null)).toEqual({
      mode: "direct",
      targetAmount: "",
      annualExpense: "",
      withdrawalRate: "4",
      monthlyContribution: "",
    });
  });

  it("保存済みの値を両タブとも復元する", () => {
    expect(toFireGoalFormValues(savedGoal, null)).toEqual({
      mode: "reverse",
      targetAmount: "80000000",
      annualExpense: "3600000",
      withdrawalRate: "3.5",
      monthlyContribution: "200000",
    });
  });

  it("保存されていない金額欄は空欄にする", () => {
    expect(
      toFireGoalFormValues(
        {
          mode: "direct",
          targetAmount: 80_000_000,
          annualExpense: null,
          withdrawalRate: 4,
          achievementAxisId: null,
          monthlyContribution: null,
        },
        null,
      ).annualExpense,
    ).toBe("");
  });

  /** 「デフォルト値ありで編集可能」な欄なので、空欄から始めさせない */
  it("逆算係数だけは未保存でも既定値を入れる", () => {
    expect(
      toFireGoalFormValues(
        {
          mode: "direct",
          targetAmount: 80_000_000,
          annualExpense: null,
          withdrawalRate: null,
          achievementAxisId: null,
          monthlyContribution: null,
        },
        null,
      ).withdrawalRate,
    ).toBe("4");
  });

  /** 要件B8「既定値として、前月の月次収支を初期表示する」 */
  it("積立額が未保存なら前月の収支を初期値に入れる", () => {
    expect(
      toFireGoalFormValues({ ...savedGoal, monthlyContribution: null }, 180_000)
        .monthlyContribution,
    ).toBe("180000");
  });

  /**
   * 保存した値がそのまま到達予測に使われる、という関係を崩さないため
   * (要件B8「保存後に追従して変わることはしない」)。
   */
  it("保存済みの積立額があれば前月の収支で上書きしない", () => {
    expect(toFireGoalFormValues(savedGoal, 180_000).monthlyContribution).toBe("200000");
  });

  /** 0は「積立なし」と決めた設定。未入力と同じには扱わない */
  it("保存済みの積立額が0でも前月の収支で上書きしない", () => {
    expect(
      toFireGoalFormValues({ ...savedGoal, monthlyContribution: 0 }, 180_000).monthlyContribution,
    ).toBe("0");
  });

  /** 前月の収支を提示できない場合(取引0件・取得失敗)は0円を入れずに空欄にする */
  it("前月の収支を提示できなければ積立額は空欄にする", () => {
    expect(
      toFireGoalFormValues({ ...savedGoal, monthlyContribution: null }, null).monthlyContribution,
    ).toBe("");
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
