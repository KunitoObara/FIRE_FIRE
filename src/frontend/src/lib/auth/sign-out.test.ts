import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeLoggedOutNotice } from "@/lib/auth/logout-notice";
import { clearPendingLogin, getPendingLogin, setPendingLogin } from "@/lib/auth/pending-login";
import { performSignOut } from "@/lib/auth/sign-out";

import type { Auth, MultiFactorResolver } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;
const resolver = {} as MultiFactorResolver;

const getFirebaseAuth = vi.fn<() => Auth>();
const signOut = vi.fn<(auth: Auth) => Promise<void>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  signOut: (auth: Auth) => signOut(auth),
}));

describe("performSignOut", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    clearPendingLogin();
    // 前のテストで立てたままの一過性フラグを掃除する
    consumeLoggedOutNotice();
  });

  it("ローカルのセッションを破棄する", async () => {
    await expect(performSignOut()).resolves.toEqual({ ok: true });

    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it("成功時は検証待ちの状態を捨てる(A5のresolver等)", async () => {
    setPendingLogin({ resolver, email: "user@example.com", rememberMe: true });

    await performSignOut();

    expect(getPendingLogin()).toBeNull();
  });

  it("成功時はA4に「ログアウトしました」を出すフラグを立てる", async () => {
    await performSignOut();

    expect(consumeLoggedOutNotice()).toBe(true);
  });

  it("渡されたキャッシュ初期化のコールバックを成功時に呼ぶ(共通ヘッダーのqueryClient.clear())", async () => {
    const clearQueryCache = vi.fn();

    await performSignOut(clearQueryCache);

    expect(clearQueryCache).toHaveBeenCalledTimes(1);
  });

  it("キャッシュ初期化を渡さなくても成功する(まだ何も取得していないA2・A3から呼ぶ場合)", async () => {
    await expect(performSignOut()).resolves.toEqual({ ok: true });
  });

  describe("失敗時", () => {
    it("通信が届かない場合はnetwork-errorとして返し、状態を変えない", async () => {
      setPendingLogin({ resolver, email: "user@example.com", rememberMe: true });
      signOut.mockRejectedValue(new FirebaseError("auth/network-request-failed", ""));

      await expect(performSignOut()).resolves.toEqual({ ok: false, reason: "network-error" });

      // サインイン状態は残ったままなので、途中の状態を巻き戻さない
      expect(getPendingLogin()).not.toBeNull();
      expect(consumeLoggedOutNotice()).toBe(false);
    });

    it("その他の失敗はunknownとして返す", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      signOut.mockRejectedValue(new FirebaseError("auth/internal-error", ""));

      await expect(performSignOut()).resolves.toEqual({ ok: false, reason: "unknown" });
    });

    it("失敗時はキャッシュ初期化を呼ばない", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      signOut.mockRejectedValue(new FirebaseError("auth/internal-error", ""));
      const clearQueryCache = vi.fn();

      await performSignOut(clearQueryCache);

      expect(clearQueryCache).not.toHaveBeenCalled();
    });
  });
});
