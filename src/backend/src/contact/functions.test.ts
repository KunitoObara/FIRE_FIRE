import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendContactMessage } from "./functions";

import type { CallableRequest } from "firebase-functions/https";

/**
 * **未ログインから叩ける唯一のcallable**なので、`request.auth`で弾けない代わりに置いた
 * 3つの守り(ハニーポット・送信間隔制限・長さ制限)が効くことを確かめる
 * (docs/screen-requirements-public.md A11)。
 */

const sendMail = vi.fn();
const reserveContactSlot = vi.fn();
const releaseContactSlot = vi.fn();

vi.mock("../login-notification/mailer", () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}));

vi.mock("./throttle", () => ({
  buildThrottleKey: (ip: string | undefined) => `key-${ip ?? "unknown"}`,
  reserveContactSlot: (...args: unknown[]) => reserveContactSlot(...args),
  releaseContactSlot: (...args: unknown[]) => releaseContactSlot(...args),
}));

const validInput = { email: "taro.yamada@example.com", body: "取込がうまくいきません。" };

const call = <Data>(data: Data, ip = "203.0.113.10"): unknown =>
  sendContactMessage.run({
    data,
    rawRequest: { ip },
  } as unknown as CallableRequest<Data>);

/** `HttpsError`の`details.reason`を取り出す */
const reasonOf = async (promise: unknown): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return (error as { details?: { reason?: string } }).details?.reason;
  }
  return undefined;
};

describe("sendContactMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-api-key");
    vi.stubEnv("CONTACT_RECIPIENT_EMAIL", "owner@example.com");
    reserveContactSlot.mockResolvedValue({ status: "reserved" });
    releaseContactSlot.mockResolvedValue(undefined);
    sendMail.mockResolvedValue({ status: "sent" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("送信枠を確保してから宛先へ送る", async () => {
    await expect(call(validInput)).resolves.toEqual({ ok: true });

    expect(reserveContactSlot).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0]?.[1]).toMatchObject({ to: "owner@example.com" });
    // 送れているので枠は戻さない
    expect(releaseContactSlot).not.toHaveBeenCalled();
  });

  it("本文と返信先をメールに載せる", async () => {
    await call(validInput);

    const message = sendMail.mock.calls[0]?.[1] as { text: string };

    expect(message.text).toContain("取込がうまくいきません。");
    expect(message.text).toContain("taro.yamada@example.com");
  });

  /**
   * 弾いたことを伝えると、送信側は何が検知されたのかを試行錯誤で特定できる。
   * 人には起こらない経路なので、正規の利用者がこの分岐で不利益を受けることもない。
   */
  it("ハニーポットが埋まっていれば送らないが、成功として返す", async () => {
    await expect(call({ ...validInput, website: "https://spam.example.com" })).resolves.toEqual({
      ok: true,
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(reserveContactSlot).not.toHaveBeenCalled();
  });

  it("ハニーポットが空文字なら通常どおり送る", async () => {
    await expect(call({ ...validInput, website: "" })).resolves.toEqual({ ok: true });

    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("送信間隔が空いていなければ送らない", async () => {
    reserveContactSlot.mockResolvedValue({ status: "throttled" });

    expect(await reasonOf(call(validInput))).toBe("throttled");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ["メールアドレスが空", { email: "", body: "本文" }],
    ["メールアドレスの形式が違う", { email: "not-an-email", body: "本文" }],
    ["本文が空", { email: "taro.yamada@example.com", body: "" }],
    ["本文が空白だけ", { email: "taro.yamada@example.com", body: "   " }],
  ])("%s なら送らない", async (_label, input) => {
    await expect(call(input)).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });

  /** 巨大な本文をそのまま上流へ流さない */
  it("本文が長すぎれば送らない", async () => {
    await expect(call({ ...validInput, body: "あ".repeat(2_001) })).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("上限ちょうどの本文は送る", async () => {
    await expect(call({ ...validInput, body: "あ".repeat(2_000) })).resolves.toEqual({ ok: true });
  });

  /** 設定不備で弾く経路より後ろで枠を確保する。送れていないのに待たせないため */
  it("宛先が未設定なら送らず、送信枠も使わない", async () => {
    vi.stubEnv("CONTACT_RECIPIENT_EMAIL", "");

    expect(await reasonOf(call(validInput))).toBe("not-configured");
    expect(sendMail).not.toHaveBeenCalled();
    expect(reserveContactSlot).not.toHaveBeenCalled();
  });

  it("APIキーが未設定ならその理由で返し、確保した枠を戻す", async () => {
    sendMail.mockResolvedValue({ status: "not-configured" });

    expect(await reasonOf(call(validInput))).toBe("not-configured");
    expect(releaseContactSlot).toHaveBeenCalledWith("key-203.0.113.10");
  });

  /** 送れていないのに1分待たせない */
  it("送信に失敗したらその理由で返し、確保した枠を戻す", async () => {
    sendMail.mockResolvedValue({ status: "failed" });

    expect(await reasonOf(call(validInput))).toBe("send-failed");
    expect(releaseContactSlot).toHaveBeenCalledWith("key-203.0.113.10");
  });

  /** 戻せなかったこと自体で失敗の理由が置き換わると、原因が分からなくなる */
  it("枠を戻せなくても送信失敗の理由をそのまま返す", async () => {
    sendMail.mockResolvedValue({ status: "failed" });
    releaseContactSlot.mockRejectedValue(new Error("firestore down"));

    expect(await reasonOf(call(validInput))).toBe("send-failed");
  });
});
