import { describe, expect, it } from "vitest";

import { resolveEmailActionTarget } from "@/lib/auth/email-action-mode";

describe("resolveEmailActionTarget", () => {
  it("resetPassword はワンタイムコードを引き継いでA7へ渡す", () => {
    expect(resolveEmailActionTarget("resetPassword", "oob-code")).toEqual({
      kind: "reset-password",
      path: "/reset-password?oobCode=oob-code",
    });
  });

  it("ワンタイムコードはURLエスケープして引き継ぐ", () => {
    expect(resolveEmailActionTarget("resetPassword", "a+b/c=d")).toEqual({
      kind: "reset-password",
      path: "/reset-password?oobCode=a%2Bb%2Fc%3Dd",
    });
  });

  it("verifyEmail はその場で確認を適用する", () => {
    expect(resolveEmailActionTarget("verifyEmail", "oob-code")).toEqual({
      kind: "verify-email",
      oobCode: "oob-code",
    });
  });

  // FIRE-FIREが送るメールは2種類のみのため、通常は到達しない
  it.each([["recoverEmail"], ["signIn"], [null]])("%s は未対応として扱う", (mode) => {
    expect(resolveEmailActionTarget(mode, "oob-code")).toEqual({ kind: "unsupported" });
  });

  describe("ワンタイムコードが無い場合", () => {
    // リンクが壊れていること自体は各画面が「無効なリンク」として案内する
    it("resetPassword はクエリを付けずにA7へ渡す", () => {
      expect(resolveEmailActionTarget("resetPassword", null)).toEqual({
        kind: "reset-password",
        path: "/reset-password",
      });
    });

    it("verifyEmail はそのまま渡す", () => {
      expect(resolveEmailActionTarget("verifyEmail", null)).toEqual({
        kind: "verify-email",
        oobCode: null,
      });
    });
  });
});
