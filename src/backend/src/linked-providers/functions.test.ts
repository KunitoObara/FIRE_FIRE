import { beforeEach, describe, expect, it, vi } from "vitest";

import { unlinkPasswordProvider } from "./functions";

import type { CallableRequest } from "firebase-functions/https";

/**
 * パスワードでのログインの解除が、本人確認と前提条件を必ず通ることを確かめる
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 *
 * パスワードの照合そのものは`../auth/verify-password`側で見ているため、ここでは
 * 「どの順で弾くか」「通ったときだけ解除するか」を対象にする。
 */

const getUser = vi.fn();
const updateUser = vi.fn();
const verifyPassword = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: (...args: unknown[]) => getUser(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
  }),
}));

vi.mock("../auth/verify-password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
}));

const passwordProvider = { providerId: "password" };
const googleProvider = { providerId: "google.com" };

/** パスワードとGoogleの両方を連携しているユーザー(解除できる状態) */
const linkedUser = {
  uid: "uid-1",
  email: "user@example.com",
  providerData: [passwordProvider, googleProvider],
};

/**
 * `onCall`が包んだハンドラを直接叩く。
 * `uid`に`null`を渡すと未サインインの呼び出しになる(既定値と区別するため`undefined`は使わない)。
 */
const call = <Data>(data: Data, uid: string | null = "uid-1"): unknown =>
  unlinkPasswordProvider.run({
    data,
    auth: uid === null ? undefined : { uid, token: {} },
  } as CallableRequest<Data>);

/** `HttpsError`の`details.reason`を取り出す */
const reasonOf = async (promise: unknown): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return (error as { details?: { reason?: string } }).details?.reason;
  }
  return undefined;
};

describe("unlinkPasswordProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(linkedUser);
    updateUser.mockResolvedValue(undefined);
    verifyPassword.mockResolvedValue({ status: "mfa-required" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("パスワードが正しければパスワードでのログインだけを解除する", async () => {
    await expect(call({ password: "correct" })).resolves.toEqual({ ok: true });
    expect(verifyPassword).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
      "correct",
    );
    expect(updateUser).toHaveBeenCalledWith("uid-1", { providersToUnlink: ["password"] });
  });

  /** 2FA登録済みのアカウントはサインインが完了しないが、パスワードは正しい */
  it("2FA待ちの応答もパスワードは正しいものとして扱う", async () => {
    verifyPassword.mockResolvedValue({ status: "signed-in" });

    await expect(call({ password: "correct" })).resolves.toEqual({ ok: true });
  });

  it("サインインしていなければ解除しない", async () => {
    await expect(reasonOf(call({ password: "correct" }, null))).resolves.toBe("unauthenticated");
    expect(updateUser).not.toHaveBeenCalled();
  });

  /** 確認ダイアログは必ずパスワードを送るが、callableを直接叩かれた場合に素通ししない */
  it("パスワードが渡らなければ解除しない", async () => {
    await expect(reasonOf(call({}))).resolves.toBe("password-required");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("パスワードが誤っていれば解除しない", async () => {
    verifyPassword.mockResolvedValue({ status: "invalid-credential" });

    await expect(reasonOf(call({ password: "wrong" }))).resolves.toBe("invalid-credential");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("上流のレート制限はその理由で返す", async () => {
    verifyPassword.mockResolvedValue({ status: "too-many-requests" });

    await expect(reasonOf(call({ password: "correct" }))).resolves.toBe("too-many-requests");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("パスワードが連携されていなければ解除しない", async () => {
    getUser.mockResolvedValue({ ...linkedUser, providerData: [googleProvider] });

    await expect(reasonOf(call({ password: "correct" }))).resolves.toBe("not-linked");
    expect(updateUser).not.toHaveBeenCalled();
  });

  /**
   * 要件の制約「最後に残った1つのログイン方法は解除できない」。
   * Identity Platform側は止めてくれないため、ここで弾けないとサインイン手段の無い
   * アカウントが残る
   */
  it("最後の1つは解除しない", async () => {
    getUser.mockResolvedValue({ ...linkedUser, providerData: [passwordProvider] });

    await expect(reasonOf(call({ password: "correct" }))).resolves.toBe("last-provider");
    expect(updateUser).not.toHaveBeenCalled();
  });

  /** 前提を満たさない呼び出しで、上流のレート制限を無駄に消費しない */
  it("前提条件を満たさない場合はパスワードの照合に進まない", async () => {
    getUser.mockResolvedValue({ ...linkedUser, providerData: [passwordProvider] });

    await reasonOf(call({ password: "correct" }));

    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("解除に失敗したら失敗として返す", async () => {
    updateUser.mockRejectedValue(new Error("upstream"));

    await expect(reasonOf(call({ password: "correct" }))).resolves.toBe("unlink-failed");
  });
});
