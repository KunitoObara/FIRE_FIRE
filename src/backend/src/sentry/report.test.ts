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

  it("HttpsErrorでもunavailableは送る(依存先へ届かなかった合図のため)", async () => {
    /*
      [X3-4]。このリポジトリの`unavailable`は全て本物の障害を包んでいる —
      再帰削除の失敗・Identity Platformの更新失敗・Resendへの送信失敗など。
      ここを除外していたため、**まさに検知したい障害**が届いていなかった。
    */
    const error = new HttpsError("unavailable", "削除できませんでした", {
      reason: "data-deletion-failed",
    });
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it.each([
    ["invalid-argument", "入力内容を確認してください"],
    ["failed-precondition", "パスワードの入力が必要です"],
    ["permission-denied", "試行回数が多すぎます"],
    ["resource-exhausted", "送信の間隔を空けてください"],
  ] as const)("利用者の通常操作(%s)は送らない", async (code, message) => {
    /* ここが緩むと、通常操作だけで無料枠(5,000件/月)を食い潰す。 */
    const error = new HttpsError(code, message);
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("お問い合わせの送信失敗でflushまで進む(積まれたイベントを取り残さないため)", async () => {
    /*
      [X3-5]の回帰テスト。A11のメール送信が失敗すると、`mailer.ts`が
      `captureWithoutWaiting`でイベントを積み(flushしない)、`contact/functions.ts`が
      `unavailable`のHttpsErrorを投げる。この経路でflushが呼ばれないと、Cloud Functions
      gen2がインスタンスを凍結した場合に**積まれたイベントごと失われる**。
    */
    captureWithoutWaiting(new Error("メールを送信できませんでした (status 500)"));
    expect(flush).not.toHaveBeenCalled();

    const error = new HttpsError("unavailable", "問い合わせを送信できませんでした", {
      reason: "send-failed",
    });
    const wrapped = withSentryReporting(async () => {
      throw error;
    });

    await expect(wrapped(request)).rejects.toBe(error);
    expect(flush).toHaveBeenCalled();
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

  it("HttpsErrorでもunavailableは送る(判定を待つ側と共有しているため)", () => {
    /* [X3-4]。`captureAndWait`と同じ`isExpectedFailure`を通す。 */
    captureWithoutWaiting(new HttpsError("unavailable", "認証基盤に接続できませんでした"));

    expect(captureException).toHaveBeenCalled();
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
