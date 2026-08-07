import { describe, expect, it } from "vitest";

import { firstQueryValue } from "@/lib/query-params";

describe("firstQueryValue", () => {
  it("値が1つならそのまま返す", () => {
    expect(firstQueryValue("oob-code")).toBe("oob-code");
  });

  it("キーが無いときはnullを返す", () => {
    expect(firstQueryValue(undefined)).toBeNull();
  });

  it("空文字はそのまま返す(欠落と区別する)", () => {
    expect(firstQueryValue("")).toBe("");
  });

  /**
   * 同名のキーが複数あるのは想定していないリンクのため、先頭を採らずに欠落と同じ扱いにする。
   * 意図しない値でワンタイムコードを使ってしまうのを避ける。
   */
  it("同名のキーが複数あるときはnullを返す", () => {
    expect(firstQueryValue(["oob-code", "another"])).toBeNull();
  });

  it("空配列もnullを返す", () => {
    expect(firstQueryValue([])).toBeNull();
  });
});
