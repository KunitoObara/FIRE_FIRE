import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "./functions";

import type { CallableRequest } from "firebase-functions/https";

/**
 * アカウント削除が、本人確認と前提条件を必ず通ることと、**途中で落ちても復旧できない側へ
 * 倒れないこと**を確かめる(docs/auth-login-requirements.md 3.11)。
 *
 * パスワードの照合そのものは`../auth/verify-password`側で見ているため、ここでは
 * 「どの順で弾くか」「通ったときだけ何をどの順で消すか」を対象にする。
 */

const getUser = vi.fn();
const deleteUser = vi.fn();
const verifyPassword = vi.fn();
const deleteUserData = vi.fn();
const deleteRecoveryCodeDocument = vi.fn();
const deleteSignUpAllowlistEntry = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: (...args: unknown[]) => getUser(...args),
    deleteUser: (...args: unknown[]) => deleteUser(...args),
  }),
}));

vi.mock("../auth/verify-password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
}));

vi.mock("./store", () => ({
  deleteUserData: (...args: unknown[]) => deleteUserData(...args),
  deleteRecoveryCodeDocument: (...args: unknown[]) => deleteRecoveryCodeDocument(...args),
  deleteSignUpAllowlistEntry: (...args: unknown[]) => deleteSignUpAllowlistEntry(...args),
}));

const passwordProvider = { providerId: "password" };
const googleProvider = { providerId: "google.com" };

/** パスワードでログインできるユーザー(削除できる状態) */
const passwordUser = {
  uid: "uid-1",
  email: "user@example.com",
  providerData: [passwordProvider, googleProvider],
};

const validInput = { password: "correct", confirmEmail: "user@example.com" };

const call = <Data>(data: Data, uid: string | null = "uid-1"): unknown =>
  deleteAccount.run({
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

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(passwordUser);
    deleteUser.mockResolvedValue(undefined);
    verifyPassword.mockResolvedValue({ status: "mfa-required" });
    deleteUserData.mockResolvedValue(undefined);
    deleteRecoveryCodeDocument.mockResolvedValue(undefined);
    deleteSignUpAllowlistEntry.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("本人確認が通れば、データとアカウントをすべて消す", async () => {
    await expect(call(validInput)).resolves.toEqual({ ok: true });

    expect(deleteUserData).toHaveBeenCalledWith("uid-1");
    expect(deleteRecoveryCodeDocument).toHaveBeenCalledWith("uid-1");
    expect(deleteSignUpAllowlistEntry).toHaveBeenCalledWith("user@example.com");
    expect(deleteUser).toHaveBeenCalledWith("uid-1");
  });

  /**
   * 逆順だと、Authのユーザーが消えたあとにFirestoreの削除が落ちた場合に、持ち主のいない
   * データが残り、本人はサインインできないのでやり直せない。
   */
  it("Firestoreを消してからAuthのユーザーを消す", async () => {
    const order: string[] = [];
    deleteUserData.mockImplementation(async () => {
      order.push("data");
    });
    deleteUser.mockImplementation(async () => {
      order.push("auth");
    });

    await call(validInput);

    expect(order).toEqual(["data", "auth"]);
  });

  it("サインインしていなければ削除しない", async () => {
    expect(await reasonOf(call(validInput, null))).toBe("unauthenticated");
    expect(deleteUserData).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  /** Googleのみのアカウントはパスワードでの本人確認を通せない(3.3と同じ制約) */
  it("パスワードでのログインが無ければ削除しない", async () => {
    getUser.mockResolvedValue({ ...passwordUser, providerData: [googleProvider] });

    expect(await reasonOf(call(validInput))).toBe("password-not-linked");
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it("確認用のメールアドレスが一致しなければ削除しない", async () => {
    expect(await reasonOf(call({ ...validInput, confirmEmail: "other@example.com" }))).toBe(
      "email-mismatch",
    );
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  /** 承認・削除と同じ正規化を通す。大文字や前後の空白で正規の利用者を弾かない */
  it("確認用のメールアドレスは表記の揺れを吸収して比べる", async () => {
    await expect(call({ ...validInput, confirmEmail: " User@Example.com " })).resolves.toEqual({
      ok: true,
    });
  });

  /**
   * 打ち間違いのたびにIdentity Platformへ問い合わせると、正規の利用者が上流の
   * レート制限に当たる。確認用のメールアドレスを先に見る。
   */
  it("メールアドレスが一致しない間はパスワードの照合に進まない", async () => {
    await reasonOf(call({ ...validInput, confirmEmail: "other@example.com" }));

    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("パスワードが渡らなければ削除しない", async () => {
    expect(await reasonOf(call({ confirmEmail: "user@example.com" }))).toBe("password-required");
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  it("パスワードが誤っていれば削除しない", async () => {
    verifyPassword.mockResolvedValue({ status: "invalid-credential" });

    expect(await reasonOf(call(validInput))).toBe("invalid-credential");
    expect(deleteUserData).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("上流のレート制限はその理由で返す", async () => {
    verifyPassword.mockResolvedValue({ status: "too-many-requests" });

    expect(await reasonOf(call(validInput))).toBe("too-many-requests");
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  /** データを消せていない以上、アカウントは残す。本人はやり直せる */
  it("データの削除に失敗したらアカウントを消さない", async () => {
    deleteUserData.mockRejectedValue(new Error("firestore down"));

    expect(await reasonOf(call(validInput))).toBe("data-deletion-failed");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("許可リストの削除に失敗してもアカウントを消さない", async () => {
    deleteSignUpAllowlistEntry.mockRejectedValue(new Error("firestore down"));

    expect(await reasonOf(call(validInput))).toBe("data-deletion-failed");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  /** データは消えているので、やり直しが要ることを画面が伝えられるよう別の理由で返す */
  it("アカウントの削除に失敗したらその理由で返す", async () => {
    deleteUser.mockRejectedValue(new Error("identity platform down"));

    expect(await reasonOf(call(validInput))).toBe("account-deletion-failed");
  });

  /**
   * 1回目が最後まで終わったあとに2回目が届くと、`getUser`の時点で見つからない。
   * ここを素通しにすると、削除は成功しているのに汎用のエラーが画面へ返る。
   */
  it("呼び出した時点で既に削除済みなら成功として返す", async () => {
    getUser.mockRejectedValue(
      Object.assign(new Error("no user"), { code: "auth/user-not-found" }),
    );

    await expect(call(validInput)).resolves.toEqual({ ok: true });
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  /** 見つからない以外の失敗は握り潰さない。原因が分からないまま成功として返さないため */
  it("ユーザーを取得できない他の失敗はそのまま投げる", async () => {
    getUser.mockRejectedValue(new Error("identity platform down"));

    await expect(call(validInput)).rejects.toThrow("identity platform down");
    expect(deleteUserData).not.toHaveBeenCalled();
  });

  /**
   * ボタンの二度押しで2回届いた場合、後から着いた呼び出しがここに来る。失敗として返すと
   * 「データは消えたがアカウントが残っている」という誤った案内を出すことになる。
   */
  it("削除の直前に消えていた場合も成功として返す", async () => {
    deleteUser.mockRejectedValue(Object.assign(new Error("no user"), {
      code: "auth/user-not-found",
    }));

    await expect(call(validInput)).resolves.toEqual({ ok: true });
  });

  it("リクエストの形式が違えば削除しない", async () => {
    await expect(call({ password: "correct" })).rejects.toThrow();
    expect(deleteUserData).not.toHaveBeenCalled();
  });
});
