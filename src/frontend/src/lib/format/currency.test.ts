import { describe, expect, it } from "vitest";

import { formatCompactJpy, formatJpy, formatPercent, formatSignedJpy } from "@/lib/format/currency";

describe("formatJpy", () => {
  it("3桁区切りと通貨単位を付ける", () => {
    expect(formatJpy(49_600_000)).toBe("¥ 49,600,000");
  });

  it("0も通貨として表示する", () => {
    expect(formatJpy(0)).toBe("¥ 0");
  });

  it("小数は円単位に丸める", () => {
    expect(formatJpy(1_234.6)).toBe("¥ 1,235");
  });

  /** 負債の残高など。同じ金額が画面によって別の書き方になると読み違いのもとになる */
  it("負の金額はformatSignedJpyと同じ形で表示する", () => {
    expect(formatJpy(-1_200)).toBe("- ¥ 1,200");
    expect(formatJpy(-1_200)).toBe(formatSignedJpy(-1_200));
  });

  /** 残高に`+`が並ぶと増減を表しているように読めてしまう */
  it("プラスの金額には符号を付けない", () => {
    expect(formatJpy(1_200)).toBe("¥ 1,200");
  });
});

describe("formatSignedJpy", () => {
  /** 色だけでプラス/マイナスを示すと色覚特性によっては区別できない */
  it("プラスの収支には符号を明示する", () => {
    expect(formatSignedJpy(134_700)).toBe("+ ¥ 134,700");
  });

  it("マイナスの収支には符号を明示する", () => {
    expect(formatSignedJpy(-134_700)).toBe("- ¥ 134,700");
  });

  it("0はプラス扱いで表示する", () => {
    expect(formatSignedJpy(0)).toBe("+ ¥ 0");
  });
});

describe("formatCompactJpy", () => {
  it("1万以上は万で丸める", () => {
    expect(formatCompactJpy(49_600_000)).toBe("4,960万");
  });

  it("1億以上は億で丸め、小数第1位まで残す", () => {
    expect(formatCompactJpy(123_000_000)).toBe("1.2億");
  });

  it("1万未満はそのまま表示する", () => {
    expect(formatCompactJpy(9_999)).toBe("9,999");
  });

  it("負の金額も同じ単位で丸める", () => {
    expect(formatCompactJpy(-49_600_000)).toBe("-4,960万");
  });
});

describe("formatPercent", () => {
  it("比率を整数のパーセントにする", () => {
    expect(formatPercent(0.62)).toBe("62%");
  });

  it("1を超える比率もそのままパーセントにする", () => {
    expect(formatPercent(1.25)).toBe("125%");
  });

  it("0は0%になる", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});
