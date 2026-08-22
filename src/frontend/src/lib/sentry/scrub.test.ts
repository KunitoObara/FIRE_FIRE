import { describe, expect, it } from "vitest";

import {
  REDACTED,
  redactSensitiveText,
  scrubEvent,
  scrubLog,
  stripUrlParameters,
} from "@/lib/sentry/scrub";

import type { ErrorEvent, Log } from "@sentry/nextjs";

/**
 * Sentryへ送る直前のスクラブ([X3]の設計方針3)。
 *
 * ここが緩むと、個人の資産額やメールアドレスが外部サービスに残る。
 * 「送られないこと」を固定するテストなので、期待値は常に消えている側で書く。
 */

/**
 * イベントの雛形。`ErrorEvent`は`type: undefined`を要求する(トランザクションと
 * 区別するための判別子)ので、ケースごとに書かずここで補う。
 */
const errorEvent = (partial: Partial<ErrorEvent>): ErrorEvent => ({
  type: undefined,
  ...partial,
});

describe("redactSensitiveText", () => {
  it("メールアドレスを伏せる", () => {
    expect(redactSensitiveText("failed to notify taro.yamada@example.com")).toBe(
      `failed to notify ${REDACTED}`,
    );
  });

  it("FirestoreのドキュメントパスからUIDを落とす", () => {
    expect(redactSensitiveText("users/aBcDeF1234567890abcdefGH/transactions/1")).toBe(
      `users/${REDACTED}/transactions/1`,
    );
  });

  it("金額や行番号のような数値はそのまま残す(スタックトレースを潰さないため)", () => {
    expect(redactSensitiveText("at line 42 of chunk 1234")).toBe("at line 42 of chunk 1234");
  });
});

describe("stripUrlParameters", () => {
  it("クエリ文字列を落としてパスだけにする", () => {
    expect(stripUrlParameters("https://example.com/dashboard?month=2026-08")).toBe(
      "https://example.com/dashboard",
    );
  });

  it("フラグメントも落とす", () => {
    expect(stripUrlParameters("/properties/abc#balance")).toBe("/properties/abc");
  });
});

describe("scrubEvent", () => {
  it("利用者情報とアプリ由来のペイロードを丸ごと落とす", () => {
    const event = errorEvent({
      user: { id: "uid-1", email: "taro.yamada@example.com", ip_address: "203.0.113.1" },
      extra: { monthlyBalance: 1_234_567 },
      request: {
        method: "POST",
        url: "https://example.com/api/import?uid=uid-1",
        query_string: "uid=uid-1",
        data: { amount: 1_234_567 },
        cookies: { session: "secret" },
        headers: { authorization: "Bearer secret" },
      },
    });

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({
      method: "POST",
      url: "https://example.com/api/import",
    });
  });

  it("例外メッセージに混ざったメールアドレスを伏せる", () => {
    const event = errorEvent({
      exception: {
        values: [{ type: "Error", value: "no allowlist entry for taro.yamada@example.com" }],
      },
    });

    expect(scrubEvent(event).exception?.values?.[0]?.value).toBe(
      `no allowlist entry for ${REDACTED}`,
    );
  });

  it("パンくずは並びだけ残し、付随データを捨てる", () => {
    const event = errorEvent({
      breadcrumbs: [
        {
          type: "http",
          category: "fetch",
          level: "info",
          timestamp: 1,
          message: "POST /api/import",
          data: { requestBody: { amount: 1_234_567 } },
        },
      ],
    });

    expect(scrubEvent(event).breadcrumbs?.[0]).toEqual({
      type: "http",
      category: "fetch",
      level: "info",
      timestamp: 1,
      message: "POST /api/import",
    });
  });

  it("例外の型やスタックトレースは残す(残さないと調査に使えない)", () => {
    const event = errorEvent({
      exception: {
        values: [
          {
            type: "TypeError",
            value: "x is not a function",
            stacktrace: { frames: [{ filename: "app.js", lineno: 12 }] },
          },
        ],
      },
    });

    const value = scrubEvent(event).exception?.values?.[0];
    expect(value?.type).toBe("TypeError");
    expect(value?.stacktrace?.frames?.[0]?.lineno).toBe(12);
  });
});

describe("scrubLog", () => {
  it("アプリ由来の数値属性を落とす(このアプリの数値は金額だから)", () => {
    const log = {
      level: "error",
      message: "failed to save",
      attributes: { totalAssets: 12_345_678, "sentry.release": "abc123", retried: true },
    } as unknown as Log;

    expect(scrubLog(log).attributes).toEqual({
      totalAssets: REDACTED,
      "sentry.release": "abc123",
      retried: true,
    });
  });

  it("本文のメールアドレスを伏せる", () => {
    const log = { level: "warn", message: "mail to taro.yamada@example.com failed" } as Log;

    expect(scrubLog(log).message).toBe(`mail to ${REDACTED} failed`);
  });
});
