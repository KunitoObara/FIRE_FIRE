import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyEmailVerification } from "@/lib/auth/email-action";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;

const getFirebaseAuth = vi.fn<() => Auth>();
const applyActionCode = vi.fn<(auth: Auth, oobCode: string) => Promise<void>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  applyActionCode: (auth: Auth, oobCode: string) => applyActionCode(auth, oobCode),
}));

const apply = (): Promise<EmailVerificationApplyResult> => applyEmailVerification("oob-code");

describe("applyEmailVerification", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    applyActionCode.mockReset();
    applyActionCode.mockResolvedValue(undefined);
  });

  it("リンクのワンタイムコードで確認を適用する", async () => {
    await expect(apply()).resolves.toEqual({ ok: true });
    expect(applyActionCode).toHaveBeenCalledWith(auth, "oob-code");
  });

  describe("失敗理由の変換", () => {
    it.each([
      // 期限切れ・形式不正・アカウント削除済みは、いずれもリンクを取り直すしかないためまとめる
      ["auth/expired-action-code", "invalid-action-code"],
      ["auth/invalid-action-code", "invalid-action-code"],
      ["auth/user-not-found", "invalid-action-code"],
      ["auth/user-disabled", "user-disabled"],
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s は %s として返す", async (code, reason) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      applyActionCode.mockRejectedValue(new FirebaseError(code, ""));

      await expect(apply()).resolves.toEqual({ ok: false, reason });
    });

    it("原因が分からないときだけコンソールに残す", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      // spyは前のテストと共有されるため、呼び出し履歴だけ落としてから数える
      consoleError.mockClear();
      applyActionCode.mockRejectedValue(new FirebaseError("auth/invalid-action-code", ""));

      await apply();
      expect(consoleError).not.toHaveBeenCalled();

      applyActionCode.mockRejectedValue(new FirebaseError("auth/internal-error", ""));

      await apply();
      expect(consoleError).toHaveBeenCalled();
    });

    it("Firebaseの設定値が不足しているときは設定不足として返す", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(apply()).resolves.toEqual({ ok: false, reason: "configuration-error" });
    });
  });
});
