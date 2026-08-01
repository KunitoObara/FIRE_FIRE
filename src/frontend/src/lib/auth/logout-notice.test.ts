import { describe, expect, it } from "vitest";

import { consumeLoggedOutNotice, markLoggedOut } from "@/lib/auth/logout-notice";

describe("logout-notice", () => {
  it("立てていなければfalseを返す", () => {
    expect(consumeLoggedOutNotice()).toBe(false);
  });

  it("立てた後はtrueを返す", () => {
    markLoggedOut();

    expect(consumeLoggedOutNotice()).toBe(true);
  });

  it("読み出すと同時に消費し、以降はfalseを返す(直後の1回だけ)", () => {
    markLoggedOut();
    consumeLoggedOutNotice();

    expect(consumeLoggedOutNotice()).toBe(false);
  });
});
