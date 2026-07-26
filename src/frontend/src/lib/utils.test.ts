import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("クラス名を結合する", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("falsyな値を除外する", () => {
    expect(cn("px-2", false && "hidden", undefined, null)).toBe("px-2");
  });

  it("競合するTailwindクラスは後勝ちでマージする", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
