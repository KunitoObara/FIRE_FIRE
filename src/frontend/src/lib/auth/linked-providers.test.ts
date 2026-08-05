import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLinkedProviders, linkGoogleAccount, unlinkProvider } from "@/lib/auth/linked-providers";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth, User, UserCredential, UserInfo } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

// `Auth.currentUser`は読み取り専用のため、テストからはこの変数を差し替えて出し分ける
let currentUser: User | null = null;
const auth = {
  get currentUser(): User | null {
    return currentUser;
  },
} as Auth;

const getFirebaseAuth = vi.fn<() => Auth>();
const linkWithPopup = vi.fn<(user: User, provider: unknown) => Promise<UserCredential>>();
const unlink = vi.fn<(user: User, providerId: string) => Promise<User>>();
const reload = vi.fn<(user: User) => Promise<void>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  linkWithPopup: (user: User, provider: unknown) => linkWithPopup(user, provider),
  reload: (user: User) => reload(user),
  unlink: (user: User, providerId: string) => unlink(user, providerId),
}));

/** 連携済みプロバイダだけを持つ`User`。判断に効くのは`providerData`のみ */
const userWith = (...providerData: Partial<UserInfo>[]): User => ({ providerData }) as User;

const passwordProvider: Partial<UserInfo> = {
  providerId: "password",
  email: "taro.yamada@example.com",
};
const googleProvider: Partial<UserInfo> = {
  providerId: "google.com",
  email: "taro.yamada@gmail.com",
};

const authError = (code: string): FirebaseError => new FirebaseError(code, "");

beforeEach(() => {
  getFirebaseAuth.mockReset();
  getFirebaseAuth.mockReturnValue(auth);
  linkWithPopup.mockReset();
  linkWithPopup.mockResolvedValue({} as UserCredential);
  unlink.mockReset();
  unlink.mockImplementation(async (user) => user);
  reload.mockReset();
  reload.mockResolvedValue(undefined);
  currentUser = userWith(passwordProvider, googleProvider);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getLinkedProviders", () => {
  it("パスワード・Googleの順で連携状況とメールアドレスを返す", () => {
    expect(getLinkedProviders()).toEqual([
      { id: "password", isLinked: true, email: "taro.yamada@example.com" },
      { id: "google.com", isLinked: true, email: "taro.yamada@gmail.com" },
    ]);
  });

  it("連携していないプロバイダは未連携として返す", () => {
    currentUser = userWith(passwordProvider);

    expect(getLinkedProviders()[1]).toEqual({ id: "google.com", isLinked: false, email: null });
  });

  /** ガードの内側にしか無い画面のため通常は起きないが、一覧の形は変えない */
  it("サインインしていなければすべて未連携として返す", () => {
    currentUser = null;

    expect(getLinkedProviders()).toEqual([
      { id: "password", isLinked: false, email: null },
      { id: "google.com", isLinked: false, email: null },
    ]);
  });
});

describe("linkGoogleAccount", () => {
  it("ポップアップで連携し、ユーザー情報を取り直す", async () => {
    currentUser = userWith(passwordProvider);

    await expect(linkGoogleAccount()).resolves.toEqual({ ok: true });
    expect(linkWithPopup).toHaveBeenCalledWith(currentUser, expect.anything());
    expect(reload).toHaveBeenCalledWith(currentUser);
  });

  /** 別のFIRE-FIREアカウントに紐付いているGoogleアカウントは連携できない(要件の制約) */
  it.each(["auth/credential-already-in-use", "auth/email-already-in-use"])(
    "%s は使用済みとして扱う",
    async (code) => {
      linkWithPopup.mockRejectedValue(authError(code));

      await expect(linkGoogleAccount()).resolves.toEqual({
        ok: false,
        reason: "credential-already-in-use",
      });
    },
  );

  /** ユーザーが自分で閉じたのは失敗ではないため、画面がエラーを出さずに済む理由を返す */
  it.each(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"])(
    "%s は取りやめとして扱う",
    async (code) => {
      linkWithPopup.mockRejectedValue(authError(code));

      await expect(linkGoogleAccount()).resolves.toEqual({ ok: false, reason: "popup-closed" });
    },
  );

  it("Firebaseの設定不足は設定エラーとして返す", async () => {
    getFirebaseAuth.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定がありません");
    });

    await expect(linkGoogleAccount()).resolves.toEqual({
      ok: false,
      reason: "configuration-error",
    });
  });

  it("サインインしていなければ連携しない", async () => {
    currentUser = null;

    await expect(linkGoogleAccount()).resolves.toEqual({ ok: false, reason: "signed-out" });
    expect(linkWithPopup).not.toHaveBeenCalled();
  });

  /** 連携自体は済んでいるため、取り直しの失敗で結果を巻き戻さない */
  it("ユーザー情報を取り直せなくても成功として返す", async () => {
    reload.mockRejectedValue(new Error("network"));

    await expect(linkGoogleAccount()).resolves.toEqual({ ok: true });
  });
});

describe("unlinkProvider", () => {
  it("連携済みのプロバイダを解除し、ユーザー情報を取り直す", async () => {
    await expect(unlinkProvider("google.com")).resolves.toEqual({ ok: true });
    expect(unlink).toHaveBeenCalledWith(currentUser, "google.com");
    expect(reload).toHaveBeenCalledWith(currentUser);
  });

  /**
   * 要件の制約「最後に残った1つのログイン方法は解除できない」。
   * Firebaseの`unlink`は止めてくれないため、ここで弾けないとサインイン手段の無い
   * アカウントが残る
   */
  it("最後の1つは解除しない", async () => {
    currentUser = userWith(googleProvider);

    await expect(unlinkProvider("google.com")).resolves.toEqual({
      ok: false,
      reason: "last-provider",
    });
    expect(unlink).not.toHaveBeenCalled();
  });

  it("連携していないプロバイダは解除しない", async () => {
    currentUser = userWith(passwordProvider);

    await expect(unlinkProvider("google.com")).resolves.toEqual({
      ok: false,
      reason: "not-linked",
    });
    expect(unlink).not.toHaveBeenCalled();
  });

  it("サインインしていなければ解除しない", async () => {
    currentUser = null;

    await expect(unlinkProvider("google.com")).resolves.toEqual({
      ok: false,
      reason: "signed-out",
    });
    expect(unlink).not.toHaveBeenCalled();
  });

  it("再ログインが必要なエラーはその理由で返す", async () => {
    unlink.mockRejectedValue(authError("auth/requires-recent-login"));

    await expect(unlinkProvider("google.com")).resolves.toEqual({
      ok: false,
      reason: "requires-recent-login",
    });
  });

  it("想定外のエラーはunknownとして返す", async () => {
    unlink.mockRejectedValue(new Error("想定外"));

    await expect(unlinkProvider("google.com")).resolves.toEqual({ ok: false, reason: "unknown" });
  });
});
