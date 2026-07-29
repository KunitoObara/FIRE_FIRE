import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyTotpForSignIn } from "@/lib/auth/mfa-verification";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth, MultiFactorInfo, MultiFactorResolver } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;

const getFirebaseAuth = vi.fn<() => Auth>();
const setPersistence = vi.fn<(auth: Auth, persistence: unknown) => Promise<void>>();
const resolveSignIn = vi.fn<() => Promise<unknown>>();
const assertionForSignIn = vi.fn<(enrollmentId: string, code: string) => unknown>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "browserLocalPersistence",
  browserSessionPersistence: "browserSessionPersistence",
  setPersistence: (auth: Auth, persistence: unknown) => setPersistence(auth, persistence),
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    assertionForSignIn: (enrollmentId: string, code: string) =>
      assertionForSignIn(enrollmentId, code),
  },
}));

const TOTP_HINT = { factorId: "totp", uid: "totp-uid" } as MultiFactorInfo;
const SMS_HINT = { factorId: "phone", uid: "phone-uid" } as MultiFactorInfo;

const loginWith = (hints: MultiFactorInfo[], rememberMe = true): PendingLogin => ({
  resolver: { hints, resolveSignIn } as unknown as MultiFactorResolver,
  email: "user@example.com",
  rememberMe,
});

const verify = (login = loginWith([TOTP_HINT])): Promise<MfaVerificationResult> =>
  verifyTotpForSignIn(login, "123456");

describe("verifyTotpForSignIn", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    setPersistence.mockReset();
    setPersistence.mockResolvedValue(undefined);
    resolveSignIn.mockReset();
    resolveSignIn.mockResolvedValue({});
    assertionForSignIn.mockReset();
    assertionForSignIn.mockReturnValue("assertion");
  });

  it("登録済みTOTPの識別子と確認コードで二次認証を完了する", async () => {
    await expect(verify()).resolves.toEqual({ ok: true });

    expect(assertionForSignIn).toHaveBeenCalledWith("totp-uid", "123456");
    expect(resolveSignIn).toHaveBeenCalledWith("assertion");
  });

  it("TOTP以外の2要素目は選ばない", async () => {
    await verify(loginWith([SMS_HINT, TOTP_HINT]));

    expect(assertionForSignIn).toHaveBeenCalledWith("totp-uid", "123456");
  });

  it("TOTPが登録されていなければ検証を試みない", async () => {
    await expect(verify(loginWith([SMS_HINT]))).resolves.toEqual({ ok: false, reason: "unknown" });

    expect(resolveSignIn).not.toHaveBeenCalled();
  });

  describe("「ログイン状態を保持する」", () => {
    // セッションが実際に作られるのはこの画面の検証成功時のため、A4の選択をここで適用し直す
    it("保持するときはブラウザを閉じても残る方式にする", async () => {
      await verify(loginWith([TOTP_HINT], true));

      expect(setPersistence).toHaveBeenCalledWith(auth, "browserLocalPersistence");
    });

    it("保持しないときはタブを閉じると切れる方式にする", async () => {
      await verify(loginWith([TOTP_HINT], false));

      expect(setPersistence).toHaveBeenCalledWith(auth, "browserSessionPersistence");
    });

    it("永続化方式を確定させてから検証する", async () => {
      const calls: string[] = [];
      setPersistence.mockImplementation(async () => {
        calls.push("setPersistence");
      });
      resolveSignIn.mockImplementation(async () => {
        calls.push("resolveSignIn");
        return {};
      });

      await verify();

      expect(calls).toEqual(["setPersistence", "resolveSignIn"]);
    });
  });

  describe("失敗理由の変換", () => {
    it.each([
      ["auth/invalid-verification-code", "invalid-verification-code"],
      ["auth/invalid-multi-factor-session", "session-expired"],
      ["auth/missing-multi-factor-session", "session-expired"],
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s は %s として返す", async (code, reason) => {
      resolveSignIn.mockRejectedValue(new FirebaseError(code, ""));

      await expect(verify()).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定不足は通信エラーと区別する", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定が不足しています");
      });

      await expect(verify()).resolves.toEqual({ ok: false, reason: "configuration-error" });
    });
  });
});
