import { describe, expect, it } from "vitest";

import { describeClient, resolveSignInMethodLabel } from "./login-context";

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * ログイン方法の判定(docs/auth-login-requirements.md 3.8)と、User-Agentの要約。
 *
 * 3.8が求めるのは「パスワード / Google」を通知メールで見分けられることなので、
 * イベントのどこに情報が載っていても拾えるかを中心に見る。
 */

/** 判定に使う項目だけを持つイベントを作る */
const eventWith = (context: Partial<AuthBlockingEvent>): AuthBlockingEvent =>
  context as AuthBlockingEvent;

describe("resolveSignInMethodLabel", () => {
  it("credentialのsignInMethodからGoogleを判定する", () => {
    expect(
      resolveSignInMethodLabel(
        eventWith({ credential: { providerId: "google.com", signInMethod: "google.com" } }),
      ),
    ).toBe("Google");
  });

  it("credentialが無くてもadditionalUserInfoからパスワードを判定する", () => {
    expect(
      resolveSignInMethodLabel(
        eventWith({ additionalUserInfo: { providerId: "password", isNewUser: false } }),
      ),
    ).toBe("パスワード");
  });

  it("credentialの内容をadditionalUserInfoより優先する", () => {
    expect(
      resolveSignInMethodLabel(
        eventWith({
          credential: { providerId: "google.com", signInMethod: "google.com" },
          additionalUserInfo: { providerId: "password", isNewUser: false },
        }),
      ),
    ).toBe("Google");
  });

  it("未知のプロバイダはIDをそのまま表示する", () => {
    expect(
      resolveSignInMethodLabel(
        eventWith({ additionalUserInfo: { providerId: "apple.com", isNewUser: false } }),
      ),
    ).toBe("apple.com");
  });

  it("手がかりが無ければ不明とする", () => {
    expect(resolveSignInMethodLabel(eventWith({}))).toBe("不明");
  });
});

describe("describeClient", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Chrome / macOS",
    ],
    [
      // Edge・OperaのUAにはChromeの名前も含まれる。先に判定できているか
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge / Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari / iOS",
    ],
    [
      // AndroidはLinuxとも名乗る
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Chrome / Android",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "Firefox / Linux"],
  ])("%s を要約する", (userAgent, expected) => {
    expect(describeClient(userAgent)).toBe(expected);
  });

  it("判別できないUser-Agentはnullを返す", () => {
    expect(describeClient("curl/8.7.1")).toBeNull();
    expect(describeClient("")).toBeNull();
  });

  it("片方しか判別できない場合は分かったほうだけを返す", () => {
    expect(describeClient("SomeBot/1.0 (Windows NT 10.0)")).toBe("Windows");
  });
});
