import { afterEach, describe, expect, it, vi } from "vitest";

import { isAppAccessGuardBypassed } from "@/constants/dev";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAppAccessGuardBypassed", () => {
  it("環境変数が未設定なら迂回しない", () => {
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", undefined);

    expect(isAppAccessGuardBypassed()).toBe(false);
  });

  it("開発時に明示的にtrueを指定したときだけ迂回する", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");

    expect(isAppAccessGuardBypassed()).toBe(true);
  });

  it("trueと厳密に一致しない値では迂回しない", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "1");

    expect(isAppAccessGuardBypassed()).toBe(false);
  });

  /**
   * 環境変数の設定ミスで本番の認証ガードが外れることがあってはならない。
   * 実際のビルドではこの分岐自体がリテラル置換で消えるが、条件そのものもここで固定しておく。
   */
  it("本番ビルドでは環境変数がtrueでも迂回しない", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");

    expect(isAppAccessGuardBypassed()).toBe(false);
  });
});
