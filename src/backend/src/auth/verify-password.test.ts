import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyPassword } from "./verify-password";

/** `accounts:signInWithPassword`の応答を差し替える */
const stubFetch = (status: number, body: unknown): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("verifyPassword", () => {
  beforeEach(() => {
    // エミュレータ向けの分岐に入らないよう、本番と同じ条件にしておく
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    // 応答の解釈だけを見たいので、エラー時のログは出さない
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("2FA登録済みでパスワードが正しい場合はmfa-required", async () => {
    stubFetch(200, { mfaPendingCredential: "pending", mfaInfo: [{ mfaEnrollmentId: "totp" }] });

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "mfa-required",
    });
  });

  it("2FA未登録でそのままサインインが成立した場合はsigned-in", async () => {
    stubFetch(200, { idToken: "id-token", localId: "uid" });

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "signed-in",
    });
  });

  it.each([
    "INVALID_LOGIN_CREDENTIALS",
    "INVALID_PASSWORD",
    "EMAIL_NOT_FOUND",
    // 無効化済みのアカウントも資格情報の誤りと同じ扱いにする(状態を外部に伝えないため)
    "USER_DISABLED",
  ])("%s はinvalid-credentialとして扱う", async (errorCode) => {
    stubFetch(400, { error: { message: errorCode } });

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "invalid-credential",
    });
  });

  it("レート制限は補足付きのメッセージでもtoo-many-requestsとして扱う", async () => {
    stubFetch(400, {
      error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER : Too many unsuccessful login attempts." },
    });

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "too-many-requests",
    });
  });

  it("想定外のエラーコードはunavailableに寄せる", async () => {
    stubFetch(500, { error: { message: "INTERNAL" } });

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("上流に到達できない場合はunavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyPassword("api-key", "user@example.com", "pw")).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("APIキーを載せたIdentity PlatformのエンドポイントへPOSTする", async () => {
    const fetchMock = stubFetch(200, { mfaPendingCredential: "pending" });

    await verifyPassword("api key/1", "user@example.com", "pw");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=api%20key%2F1",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("エミュレータ利用時はエミュレータのエンドポイントへ向ける", async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    const fetchMock = stubFetch(200, { mfaPendingCredential: "pending" });

    // エミュレータはキーを検証しないため、未設定(空文字)でも呼び出せる
    await verifyPassword("", "user@example.com", "pw");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
