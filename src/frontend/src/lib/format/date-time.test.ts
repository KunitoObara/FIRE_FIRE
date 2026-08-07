import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/format/date-time";

describe("formatDateTime", () => {
  it("エポックミリ秒を年月日と時分に整形する", () => {
    expect(formatDateTime(new Date(2026, 6, 30, 21, 52).getTime())).toBe("2026/07/30 21:52");
  });

  it("1桁の月日・時分は0詰めする", () => {
    expect(formatDateTime(new Date(2026, 0, 5, 9, 3).getTime())).toBe("2026/01/05 09:03");
  });

  /** 値の出所はcallableの応答。想定外の値で画面を壊さない */
  it("日時として解釈できない値はnullを返す", () => {
    expect(formatDateTime(Number.NaN)).toBeNull();
  });
});
