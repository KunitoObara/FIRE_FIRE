import { describe, expect, it } from "vitest";

import { DEFAULT_ACHIEVEMENT_AXIS_NAME } from "@/constants/fire-goal";
import {
  buildFireProgress,
  calculateAchievementRate,
  formatProjectedAchievementDate,
  resolveAchievementAmount,
  resolveAchievementAxis,
  toDisplayAchievementRate,
  toGaugeRatio,
} from "@/lib/dashboard/fire-progress";

const directGoal: FireGoal = {
  mode: "direct",
  targetAmount: 80_000_000,
  annualExpense: null,
  withdrawalRate: null,
  achievementAxisId: null,
  monthlyContribution: null,
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
  debtIds: [],
  propertyValuations: {},
};

const allTypesAxis: AchievementAxisOption = {
  id: "axis-all",
  name: "総資産(自作)",
  assetTypeNames: [],
  debtIds: [],
  propertyValuations: {},
};

describe("resolveAchievementAxis", () => {
  it("未設定(null)は既定の総資産として解決する", () => {
    expect(resolveAchievementAxis(null, [investmentAxis])).toEqual({
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      debtIds: [],
      propertyValuations: {},
      missing: false,
    });
  });

  it("設定済みの分類軸は名前と集計対象をそのまま返す", () => {
    expect(resolveAchievementAxis("axis-investment", [investmentAxis])).toEqual({
      name: "投資性資産",
      assetTypeNames: ["株式(現物)"],
      debtIds: [],
      propertyValuations: {},
      missing: false,
    });
  });

  /** B4で削除されても、ゲージを消したり0%にしたりはしない(要件B1) */
  it("設定済みの分類軸が見つからなければ既定へフォールバックし、その旨を返す", () => {
    expect(resolveAchievementAxis("axis-deleted", [investmentAxis])).toEqual({
      name: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      assetTypeNames: null,
      debtIds: [],
      propertyValuations: {},
      missing: true,
    });
  });
});

describe("resolveAchievementAmount", () => {
  it("既定(総資産)はCSVの合計列をそのまま採る", () => {
    expect(resolveAchievementAmount(resolveAchievementAxis(null, []), latest, [], [])).toBe(
      49_600_000,
    );
  });

  /** 資産推移グラフ・分類別内訳と同じ`sumAxisAmount`で集計することの確認 */
  it("分類軸を選んだときは対象の資産種別を足し合わせる", () => {
    expect(
      resolveAchievementAmount(
        resolveAchievementAxis(investmentAxis.id, [investmentAxis]),
        latest,
        [],
        [],
      ),
    ).toBe(30_000_000);
  });

  /** ずれるのは合計に資産種別の列として現れない額がある場合だけで、そのときはCSVの合計が正しい */
  it("集計対象が空の分類軸は全種別の足し合わせになり、既定とわずかにずれうる", () => {
    expect(
      resolveAchievementAmount(
        resolveAchievementAxis(allTypesAxis.id, [allTypesAxis]),
        latest,
        [],
        [],
      ),
    ).toBe(49_000_000);
  });

  it("資産残高が無ければnullを返す(未取込の判断は呼び出し側に委ねる)", () => {
    expect(
      resolveAchievementAmount(resolveAchievementAxis(null, []), undefined, [], []),
    ).toBeNull();
  });
});

describe("buildFireProgress", () => {
  it("直接入力の目標資産額と直近の資産残高からゲージの表示値を組み立てる", () => {
    expect(buildFireProgress(directGoal, latest, [], [], [])).toEqual({
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
      monthlyContribution: null,
    };

    expect(buildFireProgress(goal, latest, [], [], [])?.targetAmount).toBe(75_000_000);
  });

  it("目標が未設定ならnullを返す(ゲージの代わりにB8への導線を出す)", () => {
    expect(buildFireProgress(null, latest, [], [], [])).toBeNull();
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
          monthlyContribution: null,
        },
        latest,
        [],
        [],
        [],
      ),
    ).toBeNull();
  });

  /**
   * ここでnull(=目標未設定)に倒すと、目標を設定済みのユーザーに
   * 「FIRE目標が未設定です」と出てしまう
   */
  it("CSVが未取込でも、目標が設定済みなら現在資産額0円として表示する", () => {
    expect(buildFireProgress(directGoal, undefined, [], [], [])).toEqual({
      targetAmount: 80_000_000,
      currentAmount: 0,
      achievementAxisName: DEFAULT_ACHIEVEMENT_AXIS_NAME,
      achievementAxisMissing: false,
      projectedAchievementDate: null,
    });
  });

  it("対象分類に分類軸を設定していればその分類軸で集計し、分類名を併記する", () => {
    expect(
      buildFireProgress(
        { ...directGoal, achievementAxisId: investmentAxis.id },
        latest,
        [investmentAxis],
        [],
        [],
      ),
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
      buildFireProgress({ ...directGoal, achievementAxisId: "axis-deleted" }, latest, [], [], []),
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
    expect(buildFireProgress(directGoal, latest, [investmentAxis], [], [])?.currentAmount).toBe(
      49_600_000,
    );
  });

  /** 到達予測日は想定利回り(B9)を前提とする別の計算 */
  it("到達予測日は算出せずnullのままにする", () => {
    expect(buildFireProgress(directGoal, latest, [], [], [])?.projectedAchievementDate).toBeNull();
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

/**
 * 負債(B11)を含む分類軸を対象分類に選んだ場合(docs/screen-requirements-dashboard.md B1)。
 */
const debt: Debt = {
  id: "debt-1",
  name: "住宅ローン",
  balance: 20_000_000,
  originatedOn: null,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-08-05",
  balanceHistory: { "2026-08-01": 20_000_000 },
};

const netAxis: AchievementAxisOption = {
  id: "net",
  name: "純資産",
  assetTypeNames: [],
  debtIds: ["debt-1"],
  propertyValuations: {},
};

describe("負債を含む対象分類", () => {
  it("現在資産額は負債控除後の額になる", () => {
    expect(
      resolveAchievementAmount(resolveAchievementAxis(netAxis.id, [netAxis]), latest, [debt], []),
      // 分類軸を選んだ場合は`total`ではなく`byType`の足し合わせ(49,000,000)から引く
    ).toBe(49_000_000 - 20_000_000);
  });

  /** 既定(総資産)はCSVの合計そのもの。マネーフォワードの合計に負債は含まれない(B8) */
  it("既定(総資産)では負債を差し引かない", () => {
    expect(resolveAchievementAmount(resolveAchievementAxis(null, []), latest, [debt], [])).toBe(
      49_600_000,
    );
  });

  it("負債が資産を上回れば現在資産額はマイナスになる", () => {
    const hugeDebt: Debt = {
      ...debt,
      balance: 60_000_000,
      balanceHistory: { "2026-08-01": 60_000_000 },
    };

    expect(
      buildFireProgress(
        { ...directGoal, achievementAxisId: netAxis.id },
        latest,
        [netAxis],
        [hugeDebt],
        [],
      )?.currentAmount,
    ).toBe(49_000_000 - 60_000_000);
  });

  /**
   * ゲージは「いま」を表す表示なので、履歴ではなく現在の残債を引く
   * (docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
   * 履歴に従うと、資産残高の最新日より後に負債を保存した直後だけゲージが
   * 「負債なし」と同じ額を出す(B1-15の起票理由)。
   */
  it("資産残高の最新日より後に登録された負債も差し引く", () => {
    const justRegistered: Debt = {
      ...debt,
      balance: 15_000_000,
      // 資産残高の最新日(latest.date)より後の日付しか履歴に無い
      balanceHistory: { "2026-08-20": 15_000_000 },
    };

    expect(
      resolveAchievementAmount(
        resolveAchievementAxis(netAxis.id, [netAxis]),
        latest,
        [justRegistered],
        [],
      ),
    ).toBe(49_000_000 - 15_000_000);
  });

  /** 残債を手で更新したあと、CSVを取り込み直す前でも最新の残債で出す */
  it("履歴の最後の記録ではなく現在の残債を引く", () => {
    const repaid: Debt = { ...debt, balance: 12_000_000 };

    expect(
      resolveAchievementAmount(resolveAchievementAxis(netAxis.id, [netAxis]), latest, [repaid], []),
    ).toBe(49_000_000 - 12_000_000);
  });
});

/**
 * B11-3 ケース1の決定。下振れ側だけ0で止め、超過側は丸めない(DESIGN.md 9章)。
 */
describe("toDisplayAchievementRate", () => {
  it("負の達成率は0%に丸める(リングと同じ値にする)", () => {
    expect(toDisplayAchievementRate(-0.18)).toBe(0);
    expect(toGaugeRatio(-0.18)).toBe(0);
  });

  it("目標超過は丸めない(超過分を消さない)", () => {
    expect(toDisplayAchievementRate(1.2)).toBe(1.2);
    expect(toGaugeRatio(1.2)).toBe(1);
  });

  it("0〜1の範囲はそのまま返す", () => {
    expect(toDisplayAchievementRate(0.62)).toBe(0.62);
  });
});
