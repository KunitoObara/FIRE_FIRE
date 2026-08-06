import { describe, expect, it } from "vitest";

import { buildLoginNotificationMail } from "./message";

import type { LoginNotificationContext } from "./message";

/**
 * 通知メールの中身(docs/auth-login-requirements.md 3.6 / 3.8)。
 *
 * 3.6の「日時・利用デバイス/ブラウザ情報」と3.8の「ログイン方法」が本文に出ること、
 * 開発環境からの通知を件名で見分けられることを見る。
 */

const CHROME_ON_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const prodContext = (
  overrides: Partial<LoginNotificationContext> = {},
): LoginNotificationContext => ({
  signedInAt: new Date("2026-08-06T13:10:43.000Z"),
  signInMethod: "Google",
  ipAddress: "203.0.113.10",
  userAgent: CHROME_ON_MAC,
  projectId: "fire-fire-prod",
  ...overrides,
});

describe("buildLoginNotificationMail", () => {
  it("日時をJSTで表示する", () => {
    const { text } = buildLoginNotificationMail(prodContext());

    expect(text).toContain("日時: 2026/08/06 22:10:43 (JST)");
  });

  it("ログイン方法を件名と本文の両方に出す", () => {
    const mail = buildLoginNotificationMail(prodContext({ signInMethod: "パスワード" }));

    expect(mail.subject).toBe("[FIRE-FIRE] ログインがありました (パスワード)");
    expect(mail.text).toContain("ログイン方法: パスワード");
  });

  it("IPアドレスとブラウザ情報を載せる", () => {
    const { text } = buildLoginNotificationMail(prodContext());

    expect(text).toContain("IPアドレス: 203.0.113.10");
    expect(text).toContain("ブラウザ: Chrome / macOS");
    expect(text).toContain(`User-Agent: ${CHROME_ON_MAC}`);
  });

  it("要約できないUser-Agentでも生の値は残す", () => {
    const { text } = buildLoginNotificationMail(prodContext({ userAgent: "curl/8.7.1" }));

    expect(text).toContain("ブラウザ: 判別できませんでした");
    expect(text).toContain("User-Agent: curl/8.7.1");
  });

  it("値が空のときは欠落と分かるように書く", () => {
    const { text } = buildLoginNotificationMail(prodContext({ ipAddress: "", userAgent: "" }));

    expect(text).toContain("IPアドレス: (取得できませんでした)");
    expect(text).toContain("User-Agent: (取得できませんでした)");
  });

  it("本番プロジェクトでは開発環境の注記を付けない", () => {
    const mail = buildLoginNotificationMail(prodContext());

    expect(mail.subject).not.toContain("[dev]");
    expect(mail.text).not.toContain("開発環境");
  });

  it("本番以外のプロジェクトでは件名と本文で開発環境と分かるようにする", () => {
    const mail = buildLoginNotificationMail(prodContext({ projectId: "fire-fire-dev" }));

    expect(mail.subject).toBe("[FIRE-FIRE][dev] ログインがありました (Google)");
    expect(mail.text).toContain("※ これは開発環境からの通知です (プロジェクト: fire-fire-dev)。");
  });

  it("心当たりが無い場合の対応を案内する", () => {
    const { text } = buildLoginNotificationMail(prodContext());

    expect(text).toContain("心当たりがない場合");
  });
});
