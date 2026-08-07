import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateMfaRecoveryCodes, resetMfaEnrollment, useMfaRecoveryCode } from "./functions";

import type { CallableRequest } from "firebase-functions/https";

/**
 * callableの本人確認まわりの分岐を、Firebase側を差し替えて確かめる
 * (docs/screen-requirements-account.md B10「リカバリーコードの再発行」)。
 *
 * ハッシュ計算(scrypt)と正規化は`recovery-code.test.ts`側で見ているため、ここでは
 * 「どの条件でパスワードを要求するか」「解除に成功したらコードを捨てるか」だけを対象にする。
 */

const getUser = vi.fn();
const getUserByEmail = vi.fn();
const updateUser = vi.fn();
const verifyPassword = vi.fn();
const getRecoveryCodeStatus = vi.fn();
const replaceRecoveryCodes = vi.fn();
const consumeRecoveryCode = vi.fn();
const deleteRecoveryCodes = vi.fn();

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: (...args: unknown[]) => getUser(...args),
    getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
  }),
}));

vi.mock("../auth/verify-password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
}));

vi.mock("./store", () => ({
  getRecoveryCodeStatus: (...args: unknown[]) => getRecoveryCodeStatus(...args),
  replaceRecoveryCodes: (...args: unknown[]) => replaceRecoveryCodes(...args),
  consumeRecoveryCode: (...args: unknown[]) => consumeRecoveryCode(...args),
  deleteRecoveryCodes: (...args: unknown[]) => deleteRecoveryCodes(...args),
}));

const ENROLLED_AT = "Wed, 01 Jul 2026 00:00:00 GMT";

/** 2FA登録済み・メール確認済みのユーザー */
const enrolledUser = {
  uid: "uid-1",
  email: "user@example.com",
  emailVerified: true,
  multiFactor: { enrolledFactors: [{ uid: "totp-1", enrollmentTime: ENROLLED_AT }] },
};

/**
 * `onCall`が包んだハンドラを直接叩く。
 * `uid`に`null`を渡すと未サインインの呼び出しになる(既定値と区別するため`undefined`は使わない)。
 */
const call = <Data>(
  callable: { run: (request: CallableRequest<Data>) => unknown },
  data: Data,
  uid: string | null = "uid-1",
): unknown =>
  callable.run({
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

describe("generateMfaRecoveryCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(enrolledUser);
    verifyPassword.mockResolvedValue({ status: "mfa-required" });
    replaceRecoveryCodes.mockResolvedValue(undefined);
    // 既定は未発行(A3の初回発行)
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: null,
      remainingCodes: 0,
      totalCodes: 0,
    });
  });

  it("未発行ならパスワード無しで発行できる(A3の初回発行)", async () => {
    const result = (await call(generateMfaRecoveryCodes, {})) as { codes: string[] };

    expect(result.codes).toHaveLength(8);
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(replaceRecoveryCodes).toHaveBeenCalledOnce();
  });

  it("いまの2FAに対して有効なコードが残っていればパスワードを要求する", async () => {
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: Date.parse(ENROLLED_AT) + 1_000,
      remainingCodes: 8,
      totalCodes: 8,
    });

    await expect(reasonOf(call(generateMfaRecoveryCodes, {}))).resolves.toBe("password-required");
    expect(replaceRecoveryCodes).not.toHaveBeenCalled();
  });

  it("パスワードが正しければ再発行する", async () => {
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: Date.parse(ENROLLED_AT) + 1_000,
      remainingCodes: 8,
      totalCodes: 8,
    });

    const result = (await call(generateMfaRecoveryCodes, { password: "pw" })) as {
      codes: string[];
    };

    expect(result.codes).toHaveLength(8);
    expect(verifyPassword).toHaveBeenCalledWith(expect.anything(), "user@example.com", "pw");
    expect(replaceRecoveryCodes).toHaveBeenCalledOnce();
  });

  it("パスワードが誤りなら再発行せずinvalid-credentialを返す", async () => {
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: Date.parse(ENROLLED_AT) + 1_000,
      remainingCodes: 8,
      totalCodes: 8,
    });
    verifyPassword.mockResolvedValue({ status: "invalid-credential" });

    await expect(
      reasonOf(call(generateMfaRecoveryCodes, { password: "wrong" })),
    ).resolves.toBe("invalid-credential");
    expect(replaceRecoveryCodes).not.toHaveBeenCalled();
  });

  /** 削除に失敗して古いコードが残っても、A3の再登録で本人確認を求めてしまわないこと */
  it("いまの2FA登録より前に発行されたコードは初回発行として扱う", async () => {
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: Date.parse(ENROLLED_AT) - 1_000,
      remainingCodes: 8,
      totalCodes: 8,
    });

    await expect(call(generateMfaRecoveryCodes, {})).resolves.toEqual({
      codes: expect.any(Array),
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  /**
   * B10は未発行の状態でも本人確認ダイアログを出す。素通しにすると
   * 「本人確認のため入力してください」と言いながら確かめていないことになる
   */
  it("本人確認が必須でなくても、パスワードが渡されたら検証する", async () => {
    verifyPassword.mockResolvedValue({ status: "invalid-credential" });

    await expect(reasonOf(call(generateMfaRecoveryCodes, { password: "wrong" }))).resolves.toBe(
      "invalid-credential",
    );
    expect(replaceRecoveryCodes).not.toHaveBeenCalled();
  });

  it("未発行でも正しいパスワードなら発行する", async () => {
    const result = (await call(generateMfaRecoveryCodes, { password: "pw" })) as {
      codes: string[];
    };

    expect(result.codes).toHaveLength(8);
    expect(verifyPassword).toHaveBeenCalledWith(expect.anything(), "user@example.com", "pw");
  });

  /** 登録日時が読めないときは「有効なコードがある」側に倒す */
  it("2FAの登録日時が取得できない場合はパスワードを要求する", async () => {
    getUser.mockResolvedValue({
      ...enrolledUser,
      multiFactor: { enrolledFactors: [{ uid: "totp-1" }] },
    });
    getRecoveryCodeStatus.mockResolvedValue({
      generatedAt: Date.parse(ENROLLED_AT),
      remainingCodes: 8,
      totalCodes: 8,
    });

    await expect(reasonOf(call(generateMfaRecoveryCodes, {}))).resolves.toBe("password-required");
  });

  it("サインインしていなければ発行しない", async () => {
    await expect(reasonOf(call(generateMfaRecoveryCodes, {}, null))).resolves.toBe(
      "unauthenticated",
    );
    expect(getUser).not.toHaveBeenCalled();
  });

  it("2FAが未登録なら発行しない", async () => {
    getUser.mockResolvedValue({ ...enrolledUser, multiFactor: undefined });

    await expect(reasonOf(call(generateMfaRecoveryCodes, {}))).resolves.toBe("mfa-not-enrolled");
  });
});

describe("resetMfaEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(enrolledUser);
    verifyPassword.mockResolvedValue({ status: "mfa-required" });
    updateUser.mockResolvedValue(undefined);
    deleteRecoveryCodes.mockResolvedValue(undefined);
  });

  it("パスワードが正しければTOTPを解除し、リカバリーコードも捨てる", async () => {
    await expect(call(resetMfaEnrollment, { password: "pw" })).resolves.toEqual({ ok: true });

    expect(updateUser).toHaveBeenCalledWith("uid-1", {
      multiFactor: { enrolledFactors: null },
    });
    expect(deleteRecoveryCodes).toHaveBeenCalledWith("uid-1");
  });

  it("パスワードが誤りなら解除しない", async () => {
    verifyPassword.mockResolvedValue({ status: "invalid-credential" });

    await expect(reasonOf(call(resetMfaEnrollment, { password: "wrong" }))).resolves.toBe(
      "invalid-credential",
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(deleteRecoveryCodes).not.toHaveBeenCalled();
  });

  it("パスワードが無ければ解除しない", async () => {
    await expect(reasonOf(call(resetMfaEnrollment, {}))).resolves.toBe("password-required");
    expect(updateUser).not.toHaveBeenCalled();
  });

  /** サインイン済みのIDトークン(=2FA通過済みのセッション)が前提 */
  it("サインインしていなければ解除しない", async () => {
    await expect(reasonOf(call(resetMfaEnrollment, { password: "pw" }, null))).resolves.toBe(
      "unauthenticated",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("2FAが未登録なら解除するものが無い", async () => {
    getUser.mockResolvedValue({ ...enrolledUser, multiFactor: undefined });

    await expect(reasonOf(call(resetMfaEnrollment, { password: "pw" }))).resolves.toBe(
      "mfa-not-enrolled",
    );
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  /** 解除は済んでいるので、コードを消せなくても失敗にはしない */
  it("リカバリーコードの削除に失敗しても解除は成功として返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    deleteRecoveryCodes.mockRejectedValue(new Error("firestore unavailable"));

    await expect(call(resetMfaEnrollment, { password: "pw" })).resolves.toEqual({ ok: true });
  });
});

describe("useMfaRecoveryCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserByEmail.mockResolvedValue(enrolledUser);
    verifyPassword.mockResolvedValue({ status: "mfa-required" });
    consumeRecoveryCode.mockResolvedValue({ status: "consumed", remainingCodes: 7 });
    updateUser.mockResolvedValue(undefined);
    deleteRecoveryCodes.mockResolvedValue(undefined);
  });

  /** 解除後のコードは使い道が無い(この関数自体が2FA登録済みを要求する) */
  it("2FAを解除したら残りのリカバリーコードも捨てる", async () => {
    await expect(
      call(useMfaRecoveryCode, {
        email: "user@example.com",
        password: "pw",
        recoveryCode: "ABCD-2345",
      }),
    ).resolves.toEqual({ remainingCodes: 7 });

    expect(deleteRecoveryCodes).toHaveBeenCalledWith("uid-1");
  });
});
