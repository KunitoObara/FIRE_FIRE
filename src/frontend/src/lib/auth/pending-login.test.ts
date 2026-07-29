import { beforeEach, describe, expect, it } from "vitest";

import { clearPendingLogin, getPendingLogin, setPendingLogin } from "@/lib/auth/pending-login";

import type { MultiFactorResolver } from "firebase/auth";

// resolverの中身はFirebaseが組み立てるもので、ここでは受け渡されるかだけを確かめる
const resolver = {} as MultiFactorResolver;

const login: PendingLogin = { resolver, email: "user@example.com", rememberMe: true };

describe("pending-login", () => {
  beforeEach(() => {
    clearPendingLogin();
  });

  it("預けた検証待ちのログインを読み出せる", () => {
    setPendingLogin(login);

    expect(getPendingLogin()).toEqual(login);
  });

  it("読み出しでは破棄しないため、確認コードの再入力でも同じresolverを使える", () => {
    setPendingLogin(login);
    getPendingLogin();

    expect(getPendingLogin()).toEqual(login);
  });

  it("何も預けられていなければnullを返す", () => {
    expect(getPendingLogin()).toBeNull();
  });

  it("破棄した後は読み出せない", () => {
    setPendingLogin(login);
    clearPendingLogin();

    expect(getPendingLogin()).toBeNull();
  });
});
