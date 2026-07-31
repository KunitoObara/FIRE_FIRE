import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestPasswordReset } from "@/lib/auth/password-reset";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;

const getFirebaseAuth = vi.fn<() => Auth>();
// 引数の個数もそのまま記録したいので、可変長で受けて渡す
// (`actionCodeSettings`を渡していないことの確認に使う)
const sendPasswordResetEmail = vi.fn<(...args: unknown[]) => Promise<void>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const send = (): Promise<PasswordResetResult> => requestPasswordReset("user@example.com");

describe("requestPasswordReset", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    sendPasswordResetEmail.mockReset();
    sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it("入力されたメールアドレス宛に送信を依頼する", async () => {
    await expect(send()).resolves.toEqual({ ok: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, "user@example.com");
  });

  it("再設定画面(A7)は別カードのため、リンク先の指定(actionCodeSettings)は渡さない", async () => {
    await send();

    expect(sendPasswordResetEmail.mock.calls[0]).toHaveLength(2);
  });

  describe("アカウントの存在有無を伏せる", () => {
    it.each(["auth/user-not-found", "auth/invalid-email"])("%s は成功として返す", async (code) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      sendPasswordResetEmail.mockRejectedValue(new FirebaseError(code, ""));

      await expect(send()).resolves.toEqual({ ok: true });
      // コンソールが存在判定の抜け道にならないよう、ログにも残さない
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("失敗理由の変換", () => {
    it.each([
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s は %s として返す", async (code, reason) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      sendPasswordResetEmail.mockRejectedValue(new FirebaseError(code, ""));

      await expect(send()).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定値が不足しているときは設定不足として返す", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(send()).resolves.toEqual({ ok: false, reason: "configuration-error" });
    });
  });
});
