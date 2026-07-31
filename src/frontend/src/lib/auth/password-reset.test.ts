import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completePasswordReset,
  requestPasswordReset,
  verifyPasswordResetLink,
} from "@/lib/auth/password-reset";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;

const getFirebaseAuth = vi.fn<() => Auth>();
// 引数の個数もそのまま記録したいので、可変長で受けて渡す
// (`actionCodeSettings`を渡していないことの確認に使う)
const sendPasswordResetEmail = vi.fn<(...args: unknown[]) => Promise<void>>();
const verifyPasswordResetCode = vi.fn<(auth: Auth, oobCode: string) => Promise<string>>();
const confirmPasswordReset =
  vi.fn<(auth: Auth, oobCode: string, newPassword: string) => Promise<void>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
  verifyPasswordResetCode: (auth: Auth, oobCode: string) => verifyPasswordResetCode(auth, oobCode),
  confirmPasswordReset: (auth: Auth, oobCode: string, newPassword: string) =>
    confirmPasswordReset(auth, oobCode, newPassword),
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

describe("verifyPasswordResetLink", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    verifyPasswordResetCode.mockReset();
    verifyPasswordResetCode.mockResolvedValue("user@example.com");
  });

  it("リンクが有効なら、変更対象のメールアドレスを返す", async () => {
    await expect(verifyPasswordResetLink("oob-code")).resolves.toEqual({
      ok: true,
      email: "user@example.com",
    });
    expect(verifyPasswordResetCode).toHaveBeenCalledWith(auth, "oob-code");
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
      verifyPasswordResetCode.mockRejectedValue(new FirebaseError(code, ""));

      await expect(verifyPasswordResetLink("oob-code")).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定値が不足しているときは設定不足として返す", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(verifyPasswordResetLink("oob-code")).resolves.toEqual({
        ok: false,
        reason: "configuration-error",
      });
    });
  });
});

describe("completePasswordReset", () => {
  const complete = (): Promise<PasswordResetConfirmResult> =>
    completePasswordReset("oob-code", "NewPassw0rd!");

  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    confirmPasswordReset.mockReset();
    confirmPasswordReset.mockResolvedValue(undefined);
  });

  it("ワンタイムコードと新しいパスワードを渡して確定する", async () => {
    await expect(complete()).resolves.toEqual({ ok: true });
    expect(confirmPasswordReset).toHaveBeenCalledWith(auth, "oob-code", "NewPassw0rd!");
  });

  describe("失敗理由の変換", () => {
    it.each([
      // サーバー側のパスワードポリシー違反。リンクではなく入力値の問題として返す
      ["auth/weak-password", "password-policy-violation"],
      ["auth/password-does-not-meet-requirements", "password-policy-violation"],
      ["auth/expired-action-code", "invalid-action-code"],
      ["auth/invalid-action-code", "invalid-action-code"],
      ["auth/user-disabled", "user-disabled"],
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s は %s として返す", async (code, reason) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      confirmPasswordReset.mockRejectedValue(new FirebaseError(code, ""));

      await expect(complete()).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定値が不足しているときは設定不足として返す", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(complete()).resolves.toEqual({ ok: false, reason: "configuration-error" });
    });
  });
});
