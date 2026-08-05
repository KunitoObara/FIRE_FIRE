import { describe, expect, it } from "vitest";

import {
  buildFireProgress,
  calculateAchievementRate,
  formatProjectedAchievementDate,
  toGaugeRatio,
} from "@/lib/dashboard/fire-progress";

const directGoal: FireGoal = {
  mode: "direct",
  targetAmount: 80_000_000,
  annualExpense: null,
  withdrawalRate: null,
};

describe("buildFireProgress", () => {
  it("直接入力の目標資産額と直近の資産残高からゲージの表示値を組み立てる", () => {
    expect(buildFireProgress(directGoal, 49_600_000)).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 49_600_000,
      projectedAchievementDate: null,
    });
  });

  /** 有効な設定方式の判断はB8と同じ`resolveFireGoalTargetAmount`に委ねている */
  it("逆算方式なら年間支出額と逆算係数から目標資産額を導く", () => {
    const goal: FireGoal = {
      mode: "reverse",
      targetAmount: 80_000_000,
      annualExpense: 3_000_000,
      withdrawalRate: 4,
    };

    expect(buildFireProgress(goal, 49_600_000)?.targetAmount).toBe(75_000_000);
  });

  it("目標が未設定ならnullを返す(ゲージの代わりにB8への導線を出す)", () => {
    expect(buildFireProgress(null, 49_600_000)).toBeNull();
  });

  it("有効な方式の欄が埋まっていなければnullを返す", () => {
    expect(
      buildFireProgress(
        { mode: "reverse", targetAmount: 80_000_000, annualExpense: null, withdrawalRate: 4 },
        49_600_000,
      ),
    ).toBeNull();
  });

  /**
   * ここでnull(=目標未設定)に倒すと、目標を設定済みのユーザーに
   * 「FIRE目標が未設定です」と出てしまう
   */
  it("CSVが未取込でも、目標が設定済みなら現在資産額0円として表示する", () => {
    expect(buildFireProgress(directGoal, null)).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 0,
      projectedAchievementDate: null,
    });
  });

  /** 到達予測日は想定利回り(B9)を前提とする別の計算 */
  it("到達予測日は算出せずnullのままにする", () => {
    expect(buildFireProgress(directGoal, 49_600_000)?.projectedAchievementDate).toBeNull();
  });
});

describe("calculateAchievementRate", () => {
  it("現在資産額 ÷ 目標資産額 を比率で返す", () => {
    expect(calculateAchievementRate(49_600_000, 80_000_000)).toBeCloseTo(0.62, 10);
  });

  it("目標と同額なら1になる", () => {
    expect(calculateAchievementRate(80_000_000, 80_000_000)).toBe(1);
  });

  /** 超過分を切り捨てると「目標をどれだけ超えたか」が見えなくなる */
  it("目標を超えていても1で頭打ちにしない", () => {
    expect(calculateAchievementRate(100_000_000, 80_000_000)).toBe(1.25);
  });

  it("資産が0なら0になる", () => {
    expect(calculateAchievementRate(0, 80_000_000)).toBe(0);
  });

  it("負債超過(マイナスの資産)は負の比率をそのまま返す", () => {
    expect(calculateAchievementRate(-8_000_000, 80_000_000)).toBe(-0.1);
  });

  it("目標が0なら比率を定義できないためnullを返す", () => {
    expect(calculateAchievementRate(49_600_000, 0)).toBeNull();
  });

  it("目標が負でもnullを返す", () => {
    expect(calculateAchievementRate(49_600_000, -1)).toBeNull();
  });
});

describe("toGaugeRatio", () => {
  it("0〜1はそのまま通す", () => {
    expect(toGaugeRatio(0.62)).toBe(0.62);
  });

  it("1を超える分はゲージの塗りとしては1で止める", () => {
    expect(toGaugeRatio(1.25)).toBe(1);
  });

  it("負の比率は0で止める", () => {
    expect(toGaugeRatio(-0.1)).toBe(0);
  });
});

describe("formatProjectedAchievementDate", () => {
  it("年月までを「頃」付きで返す(予測値なので日までは出さない)", () => {
    expect(formatProjectedAchievementDate("2033-04-01")).toBe("2033年4月頃");
  });

  it("未算出(null)は算出できない旨を返す", () => {
    expect(formatProjectedAchievementDate(null)).toBe("算出できません");
  });

  it("日付として読めない値も算出できない扱いにする", () => {
    expect(formatProjectedAchievementDate("not-a-date")).toBe("算出できません");
  });
});
