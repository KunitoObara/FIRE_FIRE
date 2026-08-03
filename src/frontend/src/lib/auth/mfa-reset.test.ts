import { beforeEach, describe, expect, it, vi } from "vitest";

import { RESET_MFA_ENROLLMENT_FUNCTION } from "@/constants/firebase";
import { resetMfaEnrollment } from "@/lib/auth/mfa-reset";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth, User } from "firebase/auth";
import type { Functions } from "firebase/functions";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const callable = vi.fn<(data?: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn<(functions: Functions, name: string) => typeof callable>();
const getFirebaseFunctions = vi.fn<() => Functions>();
const getFirebaseAuth = vi.fn<() => Auth>();
const reload = vi.fn<(user: User) => Promise<void>>();

vi.mock("firebase/functions", () => ({
  httpsCallable: (functions: Functions, name: string) => httpsCallable(functions, name),
}));

vi.mock("firebase/auth", () => ({
  reload: (user: User) => reload(user),
}));

vi.mock("@/lib/firebase/client", async () => {
  // 設定不足の判定に実装のエラークラスを使うため、そこだけ本物を借りる
  const actual = await vi.importActual<typeof FirebaseClientModule>("@/lib/firebase/client");

  return {
    FirebaseConfigurationError: actual.FirebaseConfigurationError,
    getFirebaseFunctions: () => getFirebaseFunctions(),
    getFirebaseAuth: () => getFirebaseAuth(),
  };
});

const functions = {} as Functions;
const user = { uid: "uid-1" } as User;

/** callableが投げるエラー(FirebaseのFunctionsErrorと同じ形) */
const callableError = (code: string, reason?: string): Error =>
  Object.assign(new Error(code), { code, details: reason === undefined ? undefined : { reason } });

describe("resetMfaEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    httpsCallable.mockReturnValue(callable);
    getFirebaseFunctions.mockReturnValue(functions);
    getFirebaseAuth.mockReturnValue({ currentUser: user } as Auth);
    callable.mockResolvedValue({ data: { ok: true } });
    reload.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("パスワードを渡して解除用のcallableを呼ぶ", async () => {
    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({ ok: true });

    expect(httpsCallable).toHaveBeenCalledWith(functions, RESET_MFA_ENROLLMENT_FUNCTION);
    expect(callable).toHaveBeenCalledWith({ password: "Passw0rd!" });
  });

  /** 解除はサーバー側で行うため、取り直さないとガードが2FA登録済みのままと判定する */
  it("解除に成功したらユーザー情報を取り直す", async () => {
    await resetMfaEnrollment("Passw0rd!");

    expect(reload).toHaveBeenCalledWith(user);
  });

  it("ユーザー情報を取り直せなくても解除は成功として返す", async () => {
    reload.mockRejectedValue(new Error("network"));

    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({ ok: true });
  });

  it.each([
    ["permission-denied", "invalid-credential"],
    ["permission-denied", "too-many-requests"],
    ["failed-precondition", "mfa-not-enrolled"],
    ["failed-precondition", "password-required"],
    ["unavailable", "unenroll-failed"],
  ])("%s(%s)はそのままの理由で返す", async (code, reason) => {
    callable.mockRejectedValue(callableError(`functions/${code}`, reason));

    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({ ok: false, reason });
  });

  it("unauthenticatedは画面側の呼び方に読み替える", async () => {
    callable.mockRejectedValue(callableError("functions/unauthenticated", "unauthenticated"));

    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({
      ok: false,
      reason: "signed-out",
    });
  });

  it("Firebaseの設定不足は専用の理由で返す", async () => {
    getFirebaseFunctions.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定不足");
    });

    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({
      ok: false,
      reason: "configuration-error",
    });
  });

  it("到達できない失敗はunavailableに寄せる", async () => {
    callable.mockRejectedValue(callableError("functions/internal"));

    await expect(resetMfaEnrollment("Passw0rd!")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  /** 解除できていないのに成功として扱うと、A3で「登録済み」に弾かれて行き止まりになる */
  it("失敗した場合はユーザー情報を取り直さない", async () => {
    callable.mockRejectedValue(callableError("functions/permission-denied", "invalid-credential"));

    await resetMfaEnrollment("wrong");

    expect(reload).not.toHaveBeenCalled();
  });
});
