import { describe, expect, it } from "vitest";

import {
  calculateAchievementRate,
  formatProjectedAchievementDate,
  toGaugeRatio,
} from "@/lib/dashboard/fire-progress";

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
