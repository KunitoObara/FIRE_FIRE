import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { notifyLogin } from "./functions";

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * ログイン通知のハンドラ本体(docs/auth-login-requirements.md 3.6)。
 *
 * 「送信できなくてもログインを止めない」が要になるため、送信側を差し替えて
 * 例外が外に出ないことと、イベントの情報が漏れなくメールに渡ることを見る。
 */

const sendMail = vi.fn();

vi.mock("./mailer", () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}));

const CHROME_ON_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const signInEvent = (overrides: Partial<AuthBlockingEvent> = {}): AuthBlockingEvent =>
  ({
    data: { uid: "uid-1", email: "user@example.com" },
    timestamp: "2026-08-06T13:10:43.000Z",
    ipAddress: "203.0.113.10",
    userAgent: CHROME_ON_MAC,
    additionalUserInfo: { providerId: "password", isNewUser: false },
    ...overrides,
  }) as AuthBlockingEvent;

/** `sendMail`に渡ったメッセージ */
const sentMessage = (): { to: string; subject: string; text: string } =>
  sendMail.mock.calls[0][1] as { to: string; subject: string; text: string };

describe("notifyLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({ status: "sent" });
    // プロジェクトIDの読み取り元は複数あるため、判定に使うものだけを残す
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCP_PROJECT;
    delete process.env.FIREBASE_CONFIG;
    process.env.GCLOUD_PROJECT = "fire-fire-prod";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env.GCLOUD_PROJECT;
    delete process.env.FIREBASE_CONFIG;
    vi.restoreAllMocks();
  });

  it("登録済みメールアドレス宛に、ログイン方法を含めて送る", async () => {
    await notifyLogin(signInEvent());

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sentMessage().to).toBe("user@example.com");
    expect(sentMessage().subject).toContain("パスワード");
    expect(sentMessage().text).toContain("ログイン方法: パスワード");
  });

  it("Googleログインではログイン方法をGoogleとして送る", async () => {
    await notifyLogin(
      signInEvent({
        credential: { providerId: "google.com", signInMethod: "google.com" },
        additionalUserInfo: { providerId: "google.com", isNewUser: false },
      }),
    );

    expect(sentMessage().text).toContain("ログイン方法: Google");
  });

  it("イベントの日時・IP・User-Agentを載せる", async () => {
    await notifyLogin(signInEvent());

    expect(sentMessage().text).toContain("日時: 2026/08/06 22:10:43 (JST)");
    expect(sentMessage().text).toContain("IPアドレス: 203.0.113.10");
    expect(sentMessage().text).toContain(`User-Agent: ${CHROME_ON_MAC}`);
  });

  it("日時を解釈できない場合も送信は行う", async () => {
    await notifyLogin(signInEvent({ timestamp: "" }));

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sentMessage().text).toContain("(JST)");
  });

  it("環境変数が無くてもFIREBASE_CONFIGからプロジェクトを判定する", async () => {
    delete process.env.GCLOUD_PROJECT;
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "fire-fire-prod" });

    await notifyLogin(signInEvent());

    expect(sentMessage().subject).not.toContain("[dev]");
  });

  it("プロジェクトを特定できない場合は本番扱いにしない", async () => {
    delete process.env.GCLOUD_PROJECT;

    await notifyLogin(signInEvent());

    expect(sentMessage().subject).toContain("[dev]");
  });

  it("FIREBASE_CONFIGが壊れていても送信は行う", async () => {
    delete process.env.GCLOUD_PROJECT;
    process.env.FIREBASE_CONFIG = "{壊れたJSON";

    await notifyLogin(signInEvent());

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sentMessage().subject).toContain("[dev]");
  });

  it("メールアドレスが無いイベントでは送信しない", async () => {
    await notifyLogin(signInEvent({ data: { uid: "uid-1" } as AuthBlockingEvent["data"] }));

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("送信に失敗してもログインを止めない(例外を投げない)", async () => {
    sendMail.mockResolvedValue({ status: "failed" });

    await expect(notifyLogin(signInEvent())).resolves.toBeUndefined();
  });

  it("送信側が例外を投げた場合はそのまま呼び出し元へ伝える", async () => {
    // Blocking Function側(`sendLoginNotification`)が握り潰す前提の境界。
    // ここで握り潰すと、想定外の失敗がログに残らなくなる
    sendMail.mockRejectedValue(new Error("unexpected"));

    await expect(notifyLogin(signInEvent())).rejects.toThrow("unexpected");
  });
});
