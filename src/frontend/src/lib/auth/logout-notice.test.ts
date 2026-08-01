import { describe, expect, it } from "vitest";

import { clearLoggedOutNotice, markLoggedOut, wasLoggedOut } from "@/lib/auth/logout-notice";

describe("logout-notice", () => {
  it("立てていなければfalseを返す", () => {
    clearLoggedOutNotice();

    expect(wasLoggedOut()).toBe(false);
  });

  it("立てた後はtrueを返す", () => {
    markLoggedOut();

    expect(wasLoggedOut()).toBe(true);
  });

  it("読み出しだけでは消費しない(Strict Modeで複数回呼ばれても安全)", () => {
    markLoggedOut();

    expect(wasLoggedOut()).toBe(true);
    expect(wasLoggedOut()).toBe(true);
  });

  it("消費した後はfalseを返す(直後の1回だけ出す)", () => {
    markLoggedOut();
    clearLoggedOutNotice();

    expect(wasLoggedOut()).toBe(false);
  });
});
