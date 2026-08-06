import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendMail } from "./mailer";

/**
 * Resendへの送信(docs/auth-login-requirements.md 3.6)。
 *
 * 送信の成否がそのままログインの可否になってはいけないため(`functions.ts`)、
 * 例外を投げずに結果を返しきることを中心に見る。
 */

const MESSAGE = { to: "user@example.com", subject: "件名", text: "本文" };

const stubFetch = (response: unknown): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("sendMail", () => {
  beforeEach(() => {
    // 応答の解釈だけを見たいので、エラー時のログは出さない
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("APIキーが空なら送信を試みない", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });

    await expect(sendMail("", MESSAGE)).resolves.toEqual({ status: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("宛先・件名・本文をResendの形式で送る", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });

    await expect(sendMail("re_key", MESSAGE)).resolves.toEqual({ status: "sent" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ["user@example.com"],
      subject: "件名",
      text: "本文",
    });
    // 独自ドメインを検証していないため、Resendの共有ドメインから送る
    expect(JSON.parse(init.body as string).from).toContain("@resend.dev");
  });

  it("Blocking Functionsの7秒制限より短いタイムアウトを付ける", async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });

    await sendMail("re_key", MESSAGE);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("エラー応答は失敗として返す(例外にしない)", async () => {
    stubFetch({ ok: false, status: 422 });

    await expect(sendMail("re_key", MESSAGE)).resolves.toEqual({ status: "failed" });
  });

  it("接続できない場合も失敗として返す(例外にしない)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(sendMail("re_key", MESSAGE)).resolves.toEqual({ status: "failed" });
  });
});
