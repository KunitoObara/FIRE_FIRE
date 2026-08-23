import { describe, expect, it } from "vitest";

import { REDACTED, redactSensitiveText, scrubEvent } from "./scrub";

import type { ErrorEvent } from "@sentry/node";

/**
 * Sentryへ送る直前のスクラブ([X3]の設計方針3)。
 *
 * バックエンドで漏れうるのはメールアドレスとUID。金額は扱わないため対象にしていない
 * (`scrub.ts`の冒頭を参照)。「送られないこと」を固定するテストなので、
 * 期待値は常に消えている側で書く。
 */

/** `ErrorEvent`は`type: undefined`を要求する(トランザクションと区別する判別子)。 */
const errorEvent = (partial: Partial<ErrorEvent>): ErrorEvent => ({
  type: undefined,
  ...partial,
});

describe("redactSensitiveText", () => {
  it("メールアドレスを伏せる", () => {
    expect(redactSensitiveText("宛先 taro.yamada@example.com に送れませんでした")).toBe(
      `宛先 ${REDACTED} に送れませんでした`,
    );
  });

  it("FirestoreのドキュメントパスからUIDを落とす", () => {
    expect(redactSensitiveText("users/aBcDeF1234567890abcdefGH/settings")).toBe(
      `users/${REDACTED}/settings`,
    );
  });

  it("リカバリーコードのコレクションのUIDも落とす", () => {
    expect(redactSensitiveText("mfaRecoveryCodes/aBcDeF1234567890abcdefGH")).toBe(
      `mfaRecoveryCodes/${REDACTED}`,
    );
  });

  it("数字は残す(バックエンドは金額を扱わず、ステータスコードが切り分けの材料になるため)", () => {
    expect(redactSensitiveText("Identity Platformが400を返しました")).toBe(
      "Identity Platformが400を返しました",
    );
  });
});

describe("scrubEvent", () => {
  it("利用者情報とアプリ由来のペイロードを丸ごと落とす", () => {
    const event = errorEvent({
      user: { id: "uid-1", email: "taro.yamada@example.com", ip_address: "203.0.113.1" },
      extra: { password: "秘密" },
      request: {
        method: "POST",
        url: "https://example.com/sendContactMessage?uid=uid-1",
        query_string: "uid=uid-1",
        data: { email: "taro.yamada@example.com" },
        cookies: { session: "secret" },
        headers: { authorization: "Bearer secret" },
      },
    });

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({
      method: "POST",
      url: "https://example.com/sendContactMessage",
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

  it("例外の型やスタックトレースは残す(残さないと調査に使えない)", () => {
    const event = errorEvent({
      exception: {
        values: [
          {
            type: "TypeError",
            value: "x is not a function",
            stacktrace: { frames: [{ filename: "functions.js", lineno: 12 }] },
          },
        ],
      },
    });

    const value = scrubEvent(event).exception?.values?.[0];
    expect(value?.type).toBe("TypeError");
    expect(value?.stacktrace?.frames?.[0]?.lineno).toBe(12);
  });

  it("パンくずは並びだけ残し、付随データを捨てる", () => {
    const event = errorEvent({
      breadcrumbs: [
        {
          type: "http",
          category: "console",
          level: "error",
          timestamp: 1,
          message: "メールを送信できませんでした",
          data: { to: "taro.yamada@example.com" },
        },
      ],
    });

    expect(scrubEvent(event).breadcrumbs?.[0]).toEqual({
      type: "http",
      category: "console",
      level: "error",
      timestamp: 1,
      message: "メールを送信できませんでした",
    });
  });
});
