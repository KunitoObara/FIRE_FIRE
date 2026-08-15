import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearAccountDeletedNotice, wasAccountDeleted } from "@/lib/auth/account-deleted-notice";
import { deleteAccount } from "@/lib/auth/account-deletion";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Functions } from "firebase/functions";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const callable = vi.fn<(data?: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn<(functions: Functions, name: string) => typeof callable>();
const getFirebaseFunctions = vi.fn<() => Functions>();

vi.mock("firebase/functions", () => ({
  httpsCallable: (functions: Functions, name: string) => httpsCallable(functions, name),
}));

vi.mock("@/lib/firebase/client", async () => {
  const actual = await vi.importActual<typeof FirebaseClientModule>("@/lib/firebase/client");

  return {
    FirebaseConfigurationError: actual.FirebaseConfigurationError,
    getFirebaseFunctions: () => getFirebaseFunctions(),
  };
});

const functions = {} as Functions;

/** callableが投げるエラー(FirebaseのFunctionsErrorと同じ形) */
const callableError = (code: string, reason?: string): Error =>
  Object.assign(new Error(code), {
    code,
    details: reason === undefined ? undefined : { reason },
  });

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccountDeletedNotice();
    getFirebaseFunctions.mockReturnValue(functions);
    httpsCallable.mockReturnValue(callable);
    callable.mockResolvedValue({ data: { ok: true } });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("パスワードと確認用のメールアドレスを渡して呼ぶ", async () => {
    await expect(deleteAccount("password", "user@example.com")).resolves.toEqual({ ok: true });

    expect(httpsCallable).toHaveBeenCalledWith(functions, "deleteAccount");
    expect(callable).toHaveBeenCalledWith({
      password: "password",
      confirmEmail: "user@example.com",
    });
  });

  /** 遷移先のA0で「削除しました」を出すための一過性フラグ */
  it("成功したら削除完了のフラグを立てる", async () => {
    await deleteAccount("password", "user@example.com");

    expect(wasAccountDeleted()).toBe(true);
  });

  /** 立ててしまうと、削除できていないのにA0で完了を伝えることになる */
  it("失敗したらフラグを立てない", async () => {
    callable.mockRejectedValue(callableError("functions/permission-denied", "invalid-credential"));

    await deleteAccount("wrong", "user@example.com");

    expect(wasAccountDeleted()).toBe(false);
  });

  it.each([
    ["unauthenticated", "signed-out"],
    ["password-not-linked", "password-not-linked"],
    ["email-mismatch", "email-mismatch"],
    ["invalid-credential", "invalid-credential"],
    ["too-many-requests", "too-many-requests"],
    ["data-deletion-failed", "data-deletion-failed"],
    ["account-deletion-failed", "account-deletion-failed"],
  ])("バックエンドの理由 %s を %s として返す", async (backendReason, expected) => {
    callable.mockRejectedValue(callableError("functions/failed-precondition", backendReason));

    await expect(deleteAccount("password", "user@example.com")).resolves.toEqual({
      ok: false,
      reason: expected,
    });
  });

  it("理由が無い失敗はunavailableに寄せる", async () => {
    callable.mockRejectedValue(callableError("functions/internal"));

    await expect(deleteAccount("password", "user@example.com")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("Firebaseの設定不足はconfiguration-errorとして返す", async () => {
    getFirebaseFunctions.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定値が足りません");
    });

    await expect(deleteAccount("password", "user@example.com")).resolves.toEqual({
      ok: false,
      reason: "configuration-error",
    });
  });
});
