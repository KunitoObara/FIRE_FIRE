import { describe, expect, it } from "vitest";

import {
  buildMonthKey,
  formatMonthLabel,
  fromMonthKey,
  isMonthKey,
  toMonthKey,
  yearOfMonthKey,
} from "@/lib/dashboard/month";

/**
 * 収支サマリの対象月(`yyyy-MM`)の取り回し(docs/screen-requirements-dashboard.md B1
 * 「年月の選択」)。URLのクエリ・Firestoreの範囲・カードの表示がこの形を共有する。
 */

describe("isMonthKey", () => {
  it("`yyyy-MM`の形ならtrue", () => {
    expect(isMonthKey("2026-08")).toBe(true);
    expect(isMonthKey("1999-12")).toBe(true);
  });

  /**
   * 桁だけを見る形だと`2026-13`が通り、当月との比較も文字列の辞書順なので素通りする
   * (B11の発生年月と同じ理由)
   */
  it("月が01〜12の外ならfalse", () => {
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
  });

  it("桁や区切りが違う値はfalse", () => {
    expect(isMonthKey("2026-8")).toBe(false);
    expect(isMonthKey("2026/08")).toBe(false);
    expect(isMonthKey("2026-08-01")).toBe(false);
    expect(isMonthKey("")).toBe(false);
  });
});

describe("toMonthKey", () => {
  it("`Date`から年月を取り出す", () => {
    expect(toMonthKey(new Date("2026-08-31T23:59:00+09:00"))).toBe("2026-08");
  });

  /** 月初・月末の境界で前後の月に転ばないこと(ローカル時刻で解釈する) */
  it("月初でも同じ月になる", () => {
    expect(toMonthKey(new Date("2026-03-01T00:00:00+09:00"))).toBe("2026-03");
  });
});

describe("fromMonthKey", () => {
  it("その月の初日として読む", () => {
    const date = fromMonthKey("2025-03");

    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(1);
  });
});

describe("buildMonthKey", () => {
  it("年と月から`yyyy-MM`を組み立てる", () => {
    expect(buildMonthKey(2026, 8)).toBe("2026-08");
  });

  /** 0埋めしないと文字列の比較が時系列の比較にならず、上限の判定が崩れる */
  it("1桁の月を0埋めする", () => {
    expect(buildMonthKey(2026, 1)).toBe("2026-01");
    expect(buildMonthKey(2026, 12)).toBe("2026-12");
  });
});

describe("yearOfMonthKey", () => {
  it("年だけを取り出す", () => {
    expect(yearOfMonthKey("2025-03")).toBe(2025);
  });
});

describe("formatMonthLabel", () => {
  it("カードの見出しに出す形にする", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026年8月");
  });

  /** 見出しの数字として読む値なので、月は0埋めしない */
  it("月を0埋めしない", () => {
    expect(formatMonthLabel("2026-01")).toBe("2026年1月");
  });
});
