import { describe, expect, it } from "vitest";

import { resolveAchievementAmount, resolveAchievementAxis } from "@/lib/dashboard/fire-progress";
import {
  buildFireProjection,
  resolveProjectionBase,
  toMonthlyGrowthRate,
} from "@/lib/dashboard/fire-projection";

/**
 * 到達予測の算出(docs/screen-requirements-fire-goal.md「到達予測日の算出」)。
 *
 * 起点は当月なので、`now`はテストから固定して渡す。
 */
const now = new Date(2026, 7, 14);

/** 予測の入力。ケースごとに要る分だけ差し替える */
const input = (overrides: Partial<FireProjectionInput> = {}): FireProjectionInput => ({
  targetAmount: 20_000_000,
  balancesByType: {},
  flatAmount: 0,
  monthlyContribution: 0,
  assumptions: {},
  now,
  ...overrides,
});

/** 想定値1件分。リスクレベルは予測に効かせない(現時点では可視化のみ) */
const assumption = (expectedReturn: number | null): AssetAssumption => ({
  expectedReturn,
  riskLevel: null,
});

describe("toMonthlyGrowthRate", () => {
  /** 年1回の複利ではなく月次にする(正本)。年率6%なら12乗して1.06に戻る */
  it("年率を12乗根の月次成長率にする", () => {
    expect(toMonthlyGrowthRate(6) ** 12).toBeCloseTo(1.06, 10);
  });

  it("年率0%と未設定はどちらも成長しない(1倍)", () => {
    expect(toMonthlyGrowthRate(0)).toBe(1);
    expect(toMonthlyGrowthRate(null)).toBe(1);
  });

  /** 元本割れを見込む資産に「年率-1%」のような想定を置ける(要件B9) */
  it("マイナスの年率は1未満の成長率になる", () => {
    expect(toMonthlyGrowthRate(-12)).toBeLessThan(1);
    expect(toMonthlyGrowthRate(-12) ** 12).toBeCloseTo(0.88, 10);
  });

  /**
   * `(1 + 年率 ÷ 100)`が負になると分数のべき乗が`NaN`になり、合計が丸ごと数値でなくなる。
   * B9は絶対値100%以内しか保存できないので、下限の-100%が0(1年で資産が消える)に落ちる。
   */
  it("年率-100%以下は0にして、NaNを持ち込まない", () => {
    expect(toMonthlyGrowthRate(-100)).toBe(0);
    expect(toMonthlyGrowthRate(-150)).toBe(0);
  });
});

describe("buildFireProjection", () => {
  /**
   * 現在1,000万円・年率6%・積立0円・目標2,000万円。
   * `ln(2) ÷ ln(1.06 ^ (1/12))` ≒ 142.7ヶ月なので143ヶ月目に超える。
   */
  it("想定利回りだけで到達する場合、複利で超えた最初の月を返す", () => {
    expect(
      buildFireProjection(
        input({
          balancesByType: { "株式(現物)": 10_000_000 },
          assumptions: { "株式(現物)": assumption(6) },
        }),
      ),
      // 2026年8月 + 143ヶ月
    ).toEqual({ status: "projected", achievementDate: "2038-07-01" });
  });

  /**
   * 現在0円・年率0%・積立10万円・目標1,200万円 → ちょうど120ヶ月目。
   *
   * **積立額に利回りを掛けていないことの確認でもある**(正本)。仮に積立へ年率6%を
   * 掛けていれば120ヶ月より早く到達し、この期待値は通らない。
   */
  it("積立だけで到達する場合、利回りを掛けずに線形で積み上げる", () => {
    expect(
      buildFireProjection(
        input({
          targetAmount: 12_000_000,
          // 残高0の資産種別に利回りを置いても、積立には効かない
          balancesByType: { "株式(現物)": 0 },
          assumptions: { "株式(現物)": assumption(6) },
          monthlyContribution: 100_000,
        }),
      ),
      // 2026年8月 + 120ヶ月
    ).toEqual({ status: "projected", achievementDate: "2036-08-01" });
  });

  /** 過去日付や0ヶ月を出さずに文言へ倒す(正本「結果の区別」) */
  it("現在資産額が既に目標以上なら達成済みにする", () => {
    expect(buildFireProjection(input({ balancesByType: { "預金・現金": 20_000_000 } }))).toEqual({
      status: "achieved",
    });
    expect(buildFireProjection(input({ balancesByType: { "預金・現金": 25_000_000 } }))).toEqual({
      status: "achieved",
    });
  });

  /** 対象の資産種別の利回りが全て未設定(=0%)で、積立額も0のとき(正本の典型例) */
  it("資産が増えない設定なら到達見込みなしを返す", () => {
    expect(buildFireProjection(input({ balancesByType: { "預金・現金": 10_000_000 } }))).toEqual({
      status: "unreachable",
    });
  });

  /** 積立額のマイナス(取り崩し)が利回りの伸びを上回る場合(正本の典型例) */
  it("取り崩しで資産が減り続ける場合も到達見込みなしを返す", () => {
    expect(
      buildFireProjection(
        input({
          balancesByType: { "預金・現金": 10_000_000 },
          assumptions: { "預金・現金": assumption(1) },
          monthlyContribution: -200_000,
        }),
      ),
    ).toEqual({ status: "unreachable" });
  });

  /**
   * **正の利回り・正の積立でも、目標額が大きければ600ヶ月で届かない。**
   * 「利回りが全て未設定かつ積立0以下」のような条件で早期に倒す実装だと、この形を取り落とす。
   */
  it("正の利回りと積立があっても、目標が大きすぎれば到達見込みなしを返す", () => {
    expect(
      buildFireProjection(
        input({
          targetAmount: 100_000_000_000,
          balancesByType: { "株式(現物)": 10_000_000 },
          assumptions: { "株式(現物)": assumption(3) },
          monthlyContribution: 100_000,
        }),
      ),
    ).toEqual({ status: "unreachable" });
  });

  /** 打ち切りは「ここまで進めても届かない」ことを見込みなしと呼ぶ線で、届いた月は捨てない */
  it("打ち切りの600ヶ月ちょうどで届いた場合は到達側に倒す", () => {
    expect(
      buildFireProjection(input({ targetAmount: 600_000, monthlyContribution: 1_000 })),
      // 2026年8月 + 600ヶ月
    ).toEqual({ status: "projected", achievementDate: "2076-08-01" });
  });

  it("601ヶ月目に届く設定は到達見込みなしにする", () => {
    expect(
      buildFireProjection(input({ targetAmount: 600_001, monthlyContribution: 1_000 })),
    ).toEqual({ status: "unreachable" });
  });

  /** 据え置く分(物件・負債・合計との差額)は成長も減少もしない(正本) */
  it("据え置く分は利回りで増えないが、合計には毎月加わる", () => {
    // 据え置き500万 + 積立10万 × 100ヶ月 = 1,500万。利回りを掛けていれば早く到達する
    expect(
      buildFireProjection(
        input({
          targetAmount: 15_000_000,
          flatAmount: 5_000_000,
          monthlyContribution: 100_000,
        }),
      ),
      // 2026年8月 + 100ヶ月
    ).toEqual({ status: "projected", achievementDate: "2034-12-01" });
  });

  /** 資産残高が未取込でも予測を止めない。0円から始めて積立で到達月を出す(正本) */
  it("出発点が0円でも積立額があれば到達月を返す", () => {
    expect(
      buildFireProjection(input({ targetAmount: 1_200_000, monthlyContribution: 100_000 })),
      // 2026年8月 + 12ヶ月
    ).toEqual({ status: "projected", achievementDate: "2027-08-01" });
  });
});

/**
 * 予測の出発点(docs/screen-requirements-fire-goal.md「手順」)。
 *
 * ここでの検算は**初月が現在資産額と一致すること**で、崩れていれば成長させる分と
 * 据え置く分の切り分けが間違っている。
 */
describe("resolveProjectionBase", () => {
  const latest: AssetSnapshot = {
    date: "2026-08-01",
    // 合計は資産種別の足し合わせ(4,900万)より大きい。CSVの合計にだけ現れる額を模している
    total: 49_600_000,
    byType: { "預金・現金": 19_000_000, "株式(現物)": 30_000_000 },
  };

  const investmentAxis: AchievementAxisOption = {
    id: "axis-investment",
    name: "投資性資産",
    assetTypeNames: ["株式(現物)"],
    debtIds: ["debt-1"],
    propertyValuations: {},
  };

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

  /** 出発点の合計。初月の予測額そのもの */
  const baseTotal = (base: FireProjectionBase): number =>
    Object.values(base.balancesByType).reduce((sum, amount) => sum + amount, 0) + base.flatAmount;

  /**
   * 既定(総資産)はCSVの合計をそのまま現在資産額にする決まりなので、資産種別の内訳との
   * 差額を据え置きに回さないと初月がずれる(正本)。
   */
  it("既定(総資産)では、合計と資産種別の内訳の差額を据え置きに回す", () => {
    const base = resolveProjectionBase(resolveAchievementAxis(null, []), latest, [], []);

    expect(base.balancesByType).toEqual(latest.byType);
    expect(base.flatAmount).toBe(600_000);
    expect(baseTotal(base)).toBe(
      resolveAchievementAmount(resolveAchievementAxis(null, []), latest, [], []),
    );
  });

  it("分類軸では集計対象の資産種別だけを成長させ、負債の残債を据え置きで差し引く", () => {
    const resolution = resolveAchievementAxis(investmentAxis.id, [investmentAxis]);
    const base = resolveProjectionBase(resolution, latest, [debt], []);

    expect(base.balancesByType).toEqual({ "株式(現物)": 30_000_000 });
    expect(base.flatAmount).toBe(-20_000_000);
    expect(baseTotal(base)).toBe(resolveAchievementAmount(resolution, latest, [debt], []));
  });

  /**
   * 物件も据え置き側に入る(B4-8で分類軸が集計対象にできるようになった)。時価は手動更新が
   * 前提なので利回りを当てられず、「利ざやのみ反映」なら時価 − ローン残高が据え置かれる。
   */
  it("不動産を含む分類軸では、物件の額も据え置きに入れる", () => {
    const property: RealEstateProperty = {
      id: "property-1",
      name: "〇〇マンション101号室",
      location: "",
      acquiredOn: "2020-04",
      marketValue: 30_000_000,
      loanBalance: 18_000_000,
      updatedAt: "2026-08-05",
      valueHistory: {},
      // 収益物件ではない(賃貸収支は予測に入らない)
      rental: undefined,
    };
    const propertyAxis: AchievementAxisOption = {
      ...investmentAxis,
      id: "axis-with-property",
      debtIds: [],
      propertyValuations: { "property-1": "spread" },
    };
    const resolution = resolveAchievementAxis(propertyAxis.id, [propertyAxis]);
    const base = resolveProjectionBase(resolution, latest, [], [property]);

    // 利ざや(3,000万 − 1,800万)がそのまま据え置かれる
    expect(base.flatAmount).toBe(12_000_000);
    expect(baseTotal(base)).toBe(resolveAchievementAmount(resolution, latest, [], [property]));
  });

  /** 現在資産額も0円として扱う決まりなので、出発点も0円にする(正本) */
  it("資産残高が未取込なら出発点は0円になる", () => {
    const base = resolveProjectionBase(resolveAchievementAxis(null, []), undefined, [debt], []);

    expect(baseTotal(base)).toBe(0);
  });

  /**
   * 想定利回りが未設定の資産種別を予測から除外すると、初月が現在資産額と食い違う(正本)。
   * 除外していないことを、出発点に全ての資産種別が入っていることで確かめる。
   */
  it("想定利回りの有無にかかわらず、対象の資産種別をすべて出発点に入れる", () => {
    const base = resolveProjectionBase(resolveAchievementAxis(null, []), latest, [], []);

    expect(Object.keys(base.balancesByType)).toEqual(["預金・現金", "株式(現物)"]);
  });
});
