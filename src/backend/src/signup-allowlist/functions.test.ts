import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertSignUpAllowed } from "./functions";

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * サインアップ制限のハンドラ本体(docs/auth-login-requirements.md 3.10)。
 *
 * 要になるのは**拒否の向き**である。ログイン通知(3.6)が「失敗してもログインを止めない」
 * のに対し、こちらは「確かめられなければ作らせない」。判断が付かない場合に素通りしないことを
 * 見るのが、このテストの主目的になる。
 */

const isSignUpAllowed = vi.fn();

vi.mock("./store", () => ({
  isSignUpAllowed: (...args: unknown[]) => isSignUpAllowed(...args),
}));

const createEvent = (overrides: Partial<AuthBlockingEvent> = {}): AuthBlockingEvent =>
  ({
    data: { uid: "uid-1", email: "taro@example.com" },
    timestamp: "2026-08-15T00:00:00.000Z",
    ipAddress: "203.0.113.10",
    additionalUserInfo: { providerId: "password", isNewUser: true },
    ...overrides,
  }) as AuthBlockingEvent;

describe("assertSignUpAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("承認済みのメールアドレスなら例外を投げない", async () => {
    isSignUpAllowed.mockResolvedValue(true);

    await expect(assertSignUpAllowed(createEvent())).resolves.toBeUndefined();
    expect(isSignUpAllowed).toHaveBeenCalledWith("taro@example.com");
  });

  it("承認されていないメールアドレスなら例外を投げる", async () => {
    isSignUpAllowed.mockResolvedValue(false);

    await expect(assertSignUpAllowed(createEvent())).rejects.toThrow();
  });

  it("拒否の文言に許可リストの中身を推測できる情報を含めない", async () => {
    isSignUpAllowed.mockResolvedValue(false);

    // 入力されたアドレスを文言に混ぜると、どのアドレスで弾かれたかが応答から読める。
    // 「招待されている別のアドレスがある」ことも示唆しない
    await expect(assertSignUpAllowed(createEvent())).rejects.not.toThrow(/taro@example\.com/);
  });

  it("拒否したメールアドレスをログに残さない", async () => {
    isSignUpAllowed.mockResolvedValue(false);

    await expect(assertSignUpAllowed(createEvent())).rejects.toThrow();

    // 承認されていない第三者のアドレスを溜め込まない
    const logged = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(logged).not.toContain("taro@example.com");
  });

  it("許可リストの読み取りに失敗したら拒否する(fail-closed)", async () => {
    isSignUpAllowed.mockRejectedValue(new Error("firestore unavailable"));

    // 遮断が目的の機能なので、障害中に穴が開く方向へ倒さない
    await expect(assertSignUpAllowed(createEvent())).rejects.toThrow();
  });

  it("メールアドレスが無いアカウントは拒否する", async () => {
    // 判定の材料が無い以上は拒否する。素通りさせると許可リストの抜け道になる
    await expect(
      assertSignUpAllowed(createEvent({ data: { uid: "uid-1" } } as Partial<AuthBlockingEvent>)),
    ).rejects.toThrow();
    expect(isSignUpAllowed).not.toHaveBeenCalled();
  });

  it("メールアドレスが空文字のアカウントは拒否する", async () => {
    await expect(
      assertSignUpAllowed(
        createEvent({ data: { uid: "uid-1", email: "" } } as Partial<AuthBlockingEvent>),
      ),
    ).rejects.toThrow();
    expect(isSignUpAllowed).not.toHaveBeenCalled();
  });

  it("プロバイダを問わず同じ判定を通す(Googleログインも塞ぐ)", async () => {
    isSignUpAllowed.mockResolvedValue(false);

    // Google経由の新規作成も `beforeUserCreated` で発火するため、別扱いにしない
    await expect(
      assertSignUpAllowed(
        createEvent({
          additionalUserInfo: { providerId: "google.com", isNewUser: true },
        } as Partial<AuthBlockingEvent>),
      ),
    ).rejects.toThrow();
    expect(isSignUpAllowed).toHaveBeenCalledWith("taro@example.com");
  });

  it("正規化は照合側(store)に委ねる — ハンドラは素のアドレスを渡す", async () => {
    isSignUpAllowed.mockResolvedValue(true);

    // 正規化を2箇所に持つと、片方だけ変えたときに判定がずれる
    await assertSignUpAllowed(
      createEvent({
        data: { uid: "uid-1", email: " Taro@Example.com " },
      } as Partial<AuthBlockingEvent>),
    );

    expect(isSignUpAllowed).toHaveBeenCalledWith(" Taro@Example.com ");
  });
});
