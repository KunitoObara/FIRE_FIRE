import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email";

/**
 * 許可リストの照合に使う正規化(docs/auth-login-requirements.md 3.10)。
 *
 * 見たいのは2つ。**承認する側の手入力の揺れを吸収すること**と、
 * **それ以上は広げないこと**である。後者を落とすと別人のアドレスを承認済みとみなしうる。
 */
describe("normalizeEmail", () => {
  it("大文字小文字の違いを吸収する", () => {
    expect(normalizeEmail("Taro.Yamada@Example.com")).toBe("taro.yamada@example.com");
  });

  it("前後の空白を取り除く", () => {
    expect(normalizeEmail("  taro@example.com\n")).toBe("taro@example.com");
  });

  it("空白と大文字が同時に混じっていても揃う", () => {
    expect(normalizeEmail(" TARO@EXAMPLE.COM ")).toBe("taro@example.com");
  });

  it("ドットは残す(プロバイダ固有の正規化はしない)", () => {
    // taro.yamada@ と taroyamada@ を同一視すると、別人のアドレスを承認済みとみなしうる
    expect(normalizeEmail("taro.yamada@example.com")).not.toBe("taroyamada@example.com");
  });

  it("プラス以降を切り捨てない(プロバイダ固有の正規化はしない)", () => {
    expect(normalizeEmail("taro+fire@example.com")).toBe("taro+fire@example.com");
  });

  it("空文字はそのまま空文字を返す", () => {
    expect(normalizeEmail("   ")).toBe("");
  });
});
