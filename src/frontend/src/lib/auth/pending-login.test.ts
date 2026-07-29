import { beforeEach, describe, expect, it } from "vitest";

import { clearPendingLogin, consumePendingLogin, setPendingLogin } from "@/lib/auth/pending-login";

import type { MultiFactorResolver } from "firebase/auth";

// resolverの中身はFirebaseが組み立てるもので、ここでは受け渡されるかだけを確かめる
const resolver = {} as MultiFactorResolver;

const login: PendingLogin = { resolver, email: "user@example.com", rememberMe: true };

describe("pending-login", () => {
  beforeEach(() => {
    clearPendingLogin();
  });

  it("預けた検証待ちのログインを取り出せる", () => {
    setPendingLogin(login);

    expect(consumePendingLogin()).toEqual(login);
  });

  it("取り出しは一度きりで、2回目はnullを返す", () => {
    setPendingLogin(login);
    consumePendingLogin();

    expect(consumePendingLogin()).toBeNull();
  });

  it("何も預けられていなければnullを返す", () => {
    expect(consumePendingLogin()).toBeNull();
  });

  it("破棄した後は取り出せない", () => {
    setPendingLogin(login);
    clearPendingLogin();

    expect(consumePendingLogin()).toBeNull();
  });
});
