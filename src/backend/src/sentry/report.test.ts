import { HttpsError } from "firebase-functions/https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureWithoutWaiting, resetSentryForTest, withSentryReporting } from "./report";

import type { CallableRequest } from "firebase-functions/https";

/**
 * 何をSentryへ送り、何を送らないか([X3])。
 *
 * ここが緩むと、パスワード間違いや入力不備といった**利用者の通常操作**で
 * Sentryが埋まり、本当の障害が埋もれる。逆に締めすぎると、検知したい失敗が消える。
 */

const { init, captureException, flush } = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}));

vi.mock("@sentry/node", () => ({ init, captureException, flush }));

const request = { data: {} } as CallableRequest;

beforeEach(() => {
  process.env.SENTRY_DSN = "https://examplepublickey@o0.ingest.sentry.io/0";
  resetSentryForTest();
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
});

describe("withSentryReporting", () => {
  it("成功したハンドラの戻り値をそのまま返す", async () => {
    const wrapped = withSentryReporting(async () => ({ ok: true }));

    await expect(wrapped(request)).resolves.toEqual({ ok: true });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("想定外の例外を送り、送信完了を待ってから投げ直す", async () => {
    const error = new Error("想定していない失敗");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(flush).toHaveBeenCalled();
  });

  it("クライアントへ返す失敗(HttpsError)は送らない", async () => {
    /*
      パスワード間違いや入力不備は制御フローであって障害ではない。
      ここを送ると利用者の通常操作でSentryが埋まる。
    */
    const error = new HttpsError("unauthenticated", "サインインが必要です");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("HttpsErrorでもinternalは送る(サーバー側が壊れた合図のため)", async () => {
    const error = new HttpsError("internal", "受け付けられませんでした");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("Sentryへの送信が失敗しても、元の例外をそのまま投げ直す", async () => {
    /* Sentryの都合で呼び出し元のエラーが差し替わってはいけない。 */
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentryが落ちた");
    });
    const error = new Error("元の失敗");
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
  });
});

describe("captureWithoutWaiting", () => {
  it("送信完了を待たない(Blocking Functionsの秒数予算を削らないため)", () => {
    captureWithoutWaiting(new Error("失敗"));

    expect(captureException).toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it("クライアントへ返す失敗(HttpsError)は送らない", () => {
    captureWithoutWaiting(new HttpsError("permission-denied", "許可されていません"));

    expect(captureException).not.toHaveBeenCalled();
  });

  it("Sentryへの送信が失敗しても例外を投げない(呼び出し元を止めないため)", () => {
    captureException.mockImplementationOnce(() => {
      throw new Error("Sentryが落ちた");
    });

    expect(() => captureWithoutWaiting(new Error("失敗"))).not.toThrow();
  });

  it("DSNが空なら初期化も送信もしない", () => {
    process.env.SENTRY_DSN = "";
    resetSentryForTest();

    captureWithoutWaiting(new Error("失敗"));

    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("初期化は1度だけ(インスタンスが使い回される間に繰り返さない)", () => {
    captureWithoutWaiting(new Error("1回目"));
    captureWithoutWaiting(new Error("2回目"));

    expect(init).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(2);
  });
});
