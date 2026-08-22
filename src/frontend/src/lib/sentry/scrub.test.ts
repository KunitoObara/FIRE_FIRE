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

  it("金額らしい数字(4桁以上)を伏せる", () => {
    expect(redactSensitiveText("残高 1234567 を保存できませんでした")).toBe(
      `残高 ${REDACTED} を保存できませんでした`,
    );
  });

  it("カンマ区切りの金額も伏せる", () => {
    expect(redactSensitiveText("合計 1,234,567 円")).toBe(`合計 ${REDACTED} 円`);
  });

  it("3桁以下は残す(行番号・ステータスコードを潰さないため)", () => {
    expect(redactSensitiveText("at line 42 returned 500")).toBe("at line 42 returned 500");
  });

  it("日付はそのまま残す", () => {
    expect(redactSensitiveText("failed at 2026-08-22")).toBe("failed at 2026-08-22");
  });

  it("時刻はそのまま残す(秒あり・秒なしの両方)", () => {
    expect(redactSensitiveText("01:23:45 と 01:23")).toBe("01:23:45 と 01:23");
  });

  it("ISO形式の日時は日付と時刻の両方を残す", () => {
    expect(redactSensitiveText("2026-08-22T01:23:45")).toBe("2026-08-22T01:23:45");
  });

  it("日付の中の年だけが金額として潰れない", () => {
    /*
      `2026-08-22`の`2026`は単体なら「4桁以上」に当たる。日付を先に
      食わせていないと、ここが`[redacted]-08-22`になる。
    */
    expect(redactSensitiveText("2026-08-22")).not.toContain(REDACTED);
  });

  it("日付の形をしていない4桁の年は伏せる(区別できないため)", () => {
    expect(redactSensitiveText("year 2026")).toBe(`year ${REDACTED}`);
  });

  it("UIDを先に潰すので、UIDの頭が素通りしない", () => {
    /*
      数字を先に落とすと`users/aBcD[redacted]`になり、残った`users/aBcD`が
      UIDのパターン(6文字以上)に当たらず頭だけ漏れる。
    */
    expect(redactSensitiveText("users/aBcD1234567890abcdef")).toBe(`users/${REDACTED}`);
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

  it("例外メッセージに埋め込まれた金額を伏せる", () => {
    /*
      PR #218のレビューが指摘した経路そのもの。Firestoreは保存を拒否した値を
      エラー文へ埋め込む(`valueDescription`)ため、ここに実額が乗りうる。
    */
    const event = errorEvent({
      exception: {
        values: [
          {
            type: "FirebaseError",
            value: "Unsupported field value: 1234567 (found in field 残高)",
          },
        ],
      },
    });

    expect(scrubEvent(event).exception?.values?.[0]?.value).toBe(
      `Unsupported field value: ${REDACTED} (found in field 残高)`,
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

  it("consoleロギング統合が入れる引数(sentry.message.parameter.N)を素通りさせない", () => {
    /*
      `console.error("負債を保存できませんでした", error)`のような呼び出しでは、
      SDKが第2引数**そのもの**を`sentry.message.parameter.0`へ入れる。
      接頭辞が`sentry.`だからとSDK由来扱いすると、残高がそのまま送られる。
    */
    const log = {
      level: "error",
      message: "負債を保存できませんでした",
      attributes: {
        "sentry.message.template": "負債を保存できませんでした {}",
        "sentry.message.parameter.0": { remainingAmount: 12_345_678 },
        "sentry.release": "abc123",
      },
    } as unknown as Log;

    expect(scrubLog(log).attributes).toEqual({
      "sentry.message.template": "負債を保存できませんでした {}",
      "sentry.message.parameter.0": REDACTED,
      "sentry.release": "abc123",
    });
  });

  it("sentry.message.parameter が文字列でも、識別子は伏せる", () => {
    const log = {
      level: "error",
      message: "送信に失敗しました",
      attributes: { "sentry.message.parameter.0": "宛先 taro.yamada@example.com" },
    } as unknown as Log;

    expect(scrubLog(log).attributes).toEqual({
      "sentry.message.parameter.0": `宛先 ${REDACTED}`,
    });
  });

  it("SDK自身の属性(リリース・環境)は残す", () => {
    const log = {
      level: "error",
      message: "failed",
      attributes: { "sentry.release": "abc123", "sentry.origin": "auto.log.console" },
    } as unknown as Log;

    expect(scrubLog(log).attributes).toEqual({
      "sentry.release": "abc123",
      "sentry.origin": "auto.log.console",
    });
  });

  it("本文の金額を伏せ、日付と行番号は残す", () => {
    const log = { level: "error", message: "残高 1234567 / 2026-08-22 line 42" } as Log;

    expect(scrubLog(log).message).toBe(`残高 ${REDACTED} / 2026-08-22 line 42`);
  });

  it("本文のメールアドレスを伏せる", () => {
    const log = { level: "warn", message: "mail to taro.yamada@example.com failed" } as Log;

    expect(scrubLog(log).message).toBe(`mail to ${REDACTED} failed`);
  });
});
