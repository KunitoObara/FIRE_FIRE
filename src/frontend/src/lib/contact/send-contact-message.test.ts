import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendContactMessage } from "@/lib/contact/send-contact-message";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Functions } from "firebase/functions";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const callable = vi.fn<(data?: unknown) => Promise<{ data: unknown }>>();
const httpsCallable = vi.fn<(functions: Functions, name: string) => typeof callable>();
const getFirebaseFunctions = vi.fn<() => Functions>();

vi.mock("firebase/functions", () => ({
  httpsCallable: (functions: Functions, name: string) => httpsCallable(functions, name),
}));

vi.mock("@/lib/firebase/client", async () => {
  const actual = await vi.importActual<typeof FirebaseClientModule>("@/lib/firebase/client");

  return {
    FirebaseConfigurationError: actual.FirebaseConfigurationError,
    getFirebaseFunctions: () => getFirebaseFunctions(),
  };
});

const functions = {} as Functions;

/** callableが投げるエラー(FirebaseのFunctionsErrorと同じ形) */
const callableError = (code: string, reason?: string): Error =>
  Object.assign(new Error(code), {
    code,
    details: reason === undefined ? undefined : { reason },
  });

const input: ContactFormValues = {
  email: "taro.yamada@example.com",
  body: "資産推移グラフの表示について質問があります。",
  website: "",
};

describe("sendContactMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFirebaseFunctions.mockReturnValue(functions);
    httpsCallable.mockReturnValue(callable);
    callable.mockResolvedValue({ data: { ok: true } });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("入力をそのままcallableへ渡す", async () => {
    await expect(sendContactMessage(input)).resolves.toEqual({ ok: true });

    expect(httpsCallable).toHaveBeenCalledWith(functions, "sendContactMessage");
    expect(callable).toHaveBeenCalledWith(input);
  });

  /**
   * ハニーポットは画面で判定しない。弾かれたことが送信側に分かると、何が検知されたのかを
   * 試行錯誤で特定できてしまう(判定はサーバー側)。
   */
  it("ハニーポットが埋まっていても画面側では止めずに送る", async () => {
    await sendContactMessage({ ...input, website: "https://example.com" });

    expect(callable).toHaveBeenCalledWith({ ...input, website: "https://example.com" });
  });

  it.each<[string, ContactFailureReason]>([
    ["throttled", "throttled"],
    ["send-failed", "send-failed"],
    ["not-configured", "not-configured"],
  ])("バックエンドの理由 %s をそのまま返す", async (reason, expected) => {
    callable.mockRejectedValue(callableError("functions/unavailable", reason));

    await expect(sendContactMessage(input)).resolves.toEqual({ ok: false, reason: expected });
  });

  /**
   * `invalid-argument`だけは`details.reason`が載らない。`unknown`に丸めると
   * 「時間をおいて再試行」という、入力を直すべき人には的外れな案内になる。
   */
  it("入力不正はコードから読み替える", async () => {
    callable.mockRejectedValue(callableError("functions/invalid-argument"));

    await expect(sendContactMessage(input)).resolves.toEqual({
      ok: false,
      reason: "invalid-argument",
    });
  });

  /** callableに到達できなかった場合もSDKは`functions/internal`を投げる */
  it("届かなかった場合はunavailableを返す", async () => {
    callable.mockRejectedValue(callableError("functions/internal"));

    await expect(sendContactMessage(input)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("Firebaseの設定不足はconfiguration-errorを返す", async () => {
    getFirebaseFunctions.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定が不足しています");
    });

    await expect(sendContactMessage(input)).resolves.toEqual({
      ok: false,
      reason: "configuration-error",
    });
  });
});
