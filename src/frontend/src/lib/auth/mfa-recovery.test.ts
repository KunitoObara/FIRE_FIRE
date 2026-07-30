import { beforeEach, describe, expect, it, vi } from "vitest";

import { GENERATE_MFA_RECOVERY_CODES_FUNCTION } from "@/constants/firebase";
import { issueRecoveryCodes, redeemRecoveryCode } from "@/lib/auth/mfa-recovery";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Functions } from "firebase/functions";

import type * as FirebaseClientModule from "@/lib/firebase/client";

/** callableの中身。関数名ごとに応答を差し替えられるようにする */
const callable = vi.fn<(data?: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn<(functions: Functions, name: string) => typeof callable>();
const getFirebaseFunctions = vi.fn<() => Functions>();

vi.mock("firebase/functions", () => ({
  httpsCallable: (functions: Functions, name: string) => httpsCallable(functions, name),
}));

vi.mock("@/lib/firebase/client", async () => {
  // 設定不足の判定に実装のエラークラスを使うため、そこだけ本物を借りる
  const actual = await vi.importActual<typeof FirebaseClientModule>("@/lib/firebase/client");

  return {
    FirebaseConfigurationError: actual.FirebaseConfigurationError,
    getFirebaseFunctions: () => getFirebaseFunctions(),
  };
});

const functions = {} as Functions;

/** callableが投げるエラー(FirebaseのFunctionsErrorと同じ形) */
const callableError = (code: string, reason?: string): Error =>
  Object.assign(new Error(code), { code, details: reason === undefined ? undefined : { reason } });

const CODES = ["7F2K-9QRT", "M3XZ-2LDS"];

describe("issueRecoveryCodes", () => {
  beforeEach(() => {
    callable.mockReset();
    httpsCallable.mockReset();
    httpsCallable.mockReturnValue(callable);
    getFirebaseFunctions.mockReset();
    getFirebaseFunctions.mockReturnValue(functions);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("発行用のcallableを呼び、受け取ったコードを返す", async () => {
    callable.mockResolvedValue({ data: { codes: CODES } });

    await expect(issueRecoveryCodes()).resolves.toEqual({ ok: true, codes: CODES });
    expect(httpsCallable).toHaveBeenCalledWith(functions, GENERATE_MFA_RECOVERY_CODES_FUNCTION);
  });

  it("応答の形が想定と違えば失敗として扱う", async () => {
    callable.mockResolvedValue({ data: { codes: [] } });

    await expect(issueRecoveryCodes()).resolves.toEqual({ ok: false, reason: "unknown" });
  });

  it("Firebaseの設定不足は専用の理由で返す", async () => {
    getFirebaseFunctions.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定不足");
    });

    await expect(issueRecoveryCodes()).resolves.toEqual({
      ok: false,
      reason: "configuration-error",
    });
  });

  it.each([
    // バックエンドが載せた理由をそのまま使う。`unauthenticated`だけ画面側の呼び方に読み替える
    ["unauthenticated", "unauthenticated", "signed-out"],
    ["failed-precondition", "email-unverified", "email-unverified"],
    ["failed-precondition", "mfa-not-enrolled", "mfa-not-enrolled"],
  ])("%s(%s)は%sとして返す", async (code, reason, expected) => {
    callable.mockRejectedValue(callableError(`functions/${code}`, reason));

    await expect(issueRecoveryCodes()).resolves.toEqual({ ok: false, reason: expected });
  });

  // callableに到達できない場合もSDKはinternalを投げるため、区別せず寄せる
  it("到達できない・想定外の失敗はunavailableに寄せる", async () => {
    callable.mockRejectedValue(callableError("functions/internal"));

    await expect(issueRecoveryCodes()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("理由の分からない失敗はunknownとして返す", async () => {
    callable.mockRejectedValue(callableError("functions/invalid-argument"));

    await expect(issueRecoveryCodes()).resolves.toEqual({ ok: false, reason: "unknown" });
  });
});

describe("redeemRecoveryCode", () => {
  beforeEach(() => {
    callable.mockReset();
    httpsCallable.mockReset();
    httpsCallable.mockReturnValue(callable);
    getFirebaseFunctions.mockReset();
    getFirebaseFunctions.mockReturnValue(functions);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("メールアドレス・パスワード・コードを渡し、残り本数を返す", async () => {
    callable.mockResolvedValue({ data: { remainingCodes: 7 } });

    await expect(redeemRecoveryCode("user@example.com", "Passw0rd!", "7F2K-9QRT")).resolves.toEqual(
      { ok: true, remainingCodes: 7 },
    );
    expect(callable).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Passw0rd!",
      recoveryCode: "7F2K-9QRT",
    });
  });

  it.each([
    ["permission-denied", "invalid-recovery-code"],
    ["permission-denied", "invalid-credential"],
    ["permission-denied", "too-many-requests"],
    ["failed-precondition", "no-recovery-codes"],
    ["failed-precondition", "mfa-not-enrolled"],
    // コードは消費されているため、他の失敗と区別して伝える必要がある
    ["unavailable", "unenroll-failed"],
  ])("%s(%s)はそのままの理由で返す", async (code, reason) => {
    callable.mockRejectedValue(callableError(`functions/${code}`, reason));

    await expect(redeemRecoveryCode("user@example.com", "Passw0rd!", "7F2K-9QRT")).resolves.toEqual(
      {
        ok: false,
        reason,
      },
    );
  });

  it("到達できない失敗はunavailableに寄せる", async () => {
    callable.mockRejectedValue(callableError("functions/internal"));

    await expect(redeemRecoveryCode("user@example.com", "Passw0rd!", "7F2K-9QRT")).resolves.toEqual(
      {
        ok: false,
        reason: "unavailable",
      },
    );
  });
});
