import { describe, expect, it } from "vitest";

import { DEFAULT_ACHIEVEMENT_AXIS_NAME } from "@/constants/fire-goal";
import {
  buildFireProgress,
  calculateAchievementRate,
  formatProjectedAchievementDate,
  resolveAchievementAmount,
  resolveAchievementAxis,
  toGaugeRatio,
} from "@/lib/dashboard/fire-progress";

const directGoal: FireGoal = {
  mode: "direct",
  targetAmount: 80_000_000,
  annualExpense: null,
  withdrawalRate: null,
  achievementAxisId: null,
};

/**
 * 直近の資産残高。合計(49,600,000)は資産種別の足し合わせ(49,000,000)より大きい。
 *
 * マネーフォワードの合計に資産種別の列として現れない額が含まれる場合を模しており、
 * 既定(総資産)と「集計対象が空の分類軸」でわずかにずれることの確認に使う(要件B1・既知)。
 */
const latest: AssetSnapshot = {
  date: "2026-08-01",
  total: 49_600_000,
  byType: { "預金・現金": 9_000_000, "株式(現物)": 30_000_000, 不動産: 10_000_000 },
};

const investmentAxis: AchievementAxisOption = {
  id: "axis-investment",
  name: "投資性資産",
  assetTypeNames: ["株式(現物)"],
};

const allTypesAxis: AchievementAxisOption = {
  id: "axis-all",
  name: "総資産(自作)",
  assetTypeNames: [],
};

describe("resolveAchievementAxis", () => {
  it("未設定(null)は既定の総資産として解決する", () => {
    expect(resolveAchievementAxis(null, [investmentAxis])).toEqual({
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      missing: false,
    });
  });

  it("設定済みの分類軸は名前と集計対象をそのまま返す", () => {
    expect(resolveAchievementAxis("axis-investment", [investmentAxis])).toEqual({
      name: "投資性資産",
      assetTypeNames: ["株式(現物)"],
      missing: false,
    });
  });

  /** B4で削除されても、ゲージを消したり0%にしたりはしない(要件B1) */
  it("設定済みの分類軸が見つからなければ既定へフォールバックし、その旨を返す", () => {
    expect(resolveAchievementAxis("axis-deleted", [investmentAxis])).toEqual({
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      missing: true,
    });
  });
});

describe("resolveAchievementAmount", () => {
  it("既定(総資産)はCSVの合計列をそのまま採る", () => {
    expect(resolveAchievementAmount(resolveAchievementAxis(null, []), latest)).toBe(49_600_000);
  });

  /** 資産推移グラフ・分類別内訳と同じ`sumAxisAmount`で集計することの確認 */
  it("分類軸を選んだときは対象の資産種別を足し合わせる", () => {
    expect(
      resolveAchievementAmount(resolveAchievementAxis(investmentAxis.id, [investmentAxis]), latest),
    ).toBe(30_000_000);
  });

  /** ずれるのは合計に資産種別の列として現れない額がある場合だけで、そのときはCSVの合計が正しい */
  it("集計対象が空の分類軸は全種別の足し合わせになり、既定とわずかにずれうる", () => {
    expect(
      resolveAchievementAmount(resolveAchievementAxis(allTypesAxis.id, [allTypesAxis]), latest),
    ).toBe(49_000_000);
  });

  it("資産残高が無ければnullを返す(未取込の判断は呼び出し側に委ねる)", () => {
    expect(resolveAchievementAmount(resolveAchievementAxis(null, []), undefined)).toBeNull();
  });
});

describe("buildFireProgress", () => {
  it("直接入力の目標資産額と直近の資産残高からゲージの表示値を組み立てる", () => {
    expect(buildFireProgress(directGoal, latest, [])).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 49_600_000,
      achievementAxisName: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      achievementAxisMissing: false,
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
      achievementAxisId: null,
    };

    expect(buildFireProgress(goal, latest, [])?.targetAmount).toBe(75_000_000);
  });

  it("目標が未設定ならnullを返す(ゲージの代わりにB8への導線を出す)", () => {
    expect(buildFireProgress(null, latest, [])).toBeNull();
  });

  it("有効な方式の欄が埋まっていなければnullを返す", () => {
    expect(
      buildFireProgress(
        {
          mode: "reverse",
          targetAmount: 80_000_000,
          annualExpense: null,
          withdrawalRate: 4,
          achievementAxisId: null,
        },
        latest,
        [],
      ),
    ).toBeNull();
  });

  /**
   * ここでnull(=目標未設定)に倒すと、目標を設定済みのユーザーに
   * 「FIRE目標が未設定です」と出てしまう
   */
  it("CSVが未取込でも、目標が設定済みなら現在資産額0円として表示する", () => {
    expect(buildFireProgress(directGoal, undefined, [])).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 0,
      achievementAxisName: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      achievementAxisMissing: false,
      projectedAchievementDate: null,
    });
  });

  it("対象分類に分類軸を設定していればその分類軸で集計し、分類名を併記する", () => {
    expect(
      buildFireProgress({ ...directGoal, achievementAxisId: investmentAxis.id }, latest, [
        investmentAxis,
      ]),
    ).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 30_000_000,
      achievementAxisName: "投資性資産",
      achievementAxisMissing: false,
      projectedAchievementDate: null,
    });
  });

  /** 削除された分類軸を指したままでも、既定で計算して注意書きの材料だけを渡す(要件B1) */
  it("対象分類の分類軸が削除されていたら既定で計算し、フォールバックした旨を返す", () => {
    expect(
      buildFireProgress({ ...directGoal, achievementAxisId: "axis-deleted" }, latest, []),
    ).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 49_600_000,
      achievementAxisName: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      achievementAxisMissing: true,
      projectedAchievementDate: null,
    });
  });

  /** 対象分類を持たずに保存された既存の目標が、これまでと同じ値のままになることの確認 */
  it("対象分類が未設定の既存の目標は、分類軸が登録済みでも総資産のまま計算する", () => {
    expect(buildFireProgress(directGoal, latest, [investmentAxis])?.currentAmount).toBe(49_600_000);
  });

  /** 到達予測日は想定利回り(B9)を前提とする別の計算 */
  it("到達予測日は算出せずnullのままにする", () => {
    expect(buildFireProgress(directGoal, latest, [])?.projectedAchievementDate).toBeNull();
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
