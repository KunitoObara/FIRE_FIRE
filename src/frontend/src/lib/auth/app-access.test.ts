import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAppAccessState, subscribeToAppAccessState } from "@/lib/auth/app-access";

import type { User } from "firebase/auth";

/** Identity Platformが返す2要素目の登録情報の形。TOTPか電話かは持っているキーで決まる */
const totpEnrollment = {
  mfaEnrollmentId: "totp-1",
  enrolledAt: "2026-07-01T00:00:00Z",
  totpInfo: {},
};
const phoneEnrollment = {
  mfaEnrollmentId: "phone-1",
  enrolledAt: "2026-07-01T00:00:00Z",
  phoneInfo: "+81 90-0000-0000",
};

/**
 * 判定に使うのは`emailVerified`と登録済みの2要素目だけなので、その2つだけを持つ最小のユーザーを作る。
 *
 * `multiFactor(user)`は`user._onReload`に渡したコールバックへサーバー応答が流れてくる前提で
 * `enrolledFactors`を組み立てるため、テスト側では即座にコールバックを呼ぶ実装にしておく。
 */
const userWith = (emailVerified: boolean, mfaInfo: object[]): User =>
  ({
    emailVerified,
    _onReload: (callback: (info: { mfaInfo: object[] }) => void) => callback({ mfaInfo }),
  }) as unknown as User;

describe("resolveAppAccessState", () => {
  it("セッションが無ければsigned-out", () => {
    expect(resolveAppAccessState(null)).toBe("signed-out");
  });

  it("メールアドレスが未確認ならemail-unverified", () => {
    expect(resolveAppAccessState(userWith(false, [totpEnrollment]))).toBe("email-unverified");
  });

  /** 手順どおり、メール確認が終わるまで2FAの有無は見ない */
  it("メール未確認は2FA未登録より優先する", () => {
    expect(resolveAppAccessState(userWith(false, []))).toBe("email-unverified");
  });

  it("2FA(TOTP)が未登録ならmfa-required", () => {
    expect(resolveAppAccessState(userWith(true, []))).toBe("mfa-required");
  });

  /** 2FAはTOTP必須。他方式が登録されていても代わりにはならない */
  it("TOTP以外の2要素目しか無い場合もmfa-required", () => {
    expect(resolveAppAccessState(userWith(true, [phoneEnrollment]))).toBe("mfa-required");
  });

  it("メール確認済みかつTOTP登録済みならready", () => {
    expect(resolveAppAccessState(userWith(true, [totpEnrollment]))).toBe("ready");
  });
});

describe("subscribeToAppAccessState", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * 迂回中はFirebaseに触れずに`ready`を返す(Firebase未設定でも画面を開ける)。
   */
  it("開発時の迂回が有効なら、Firebaseを呼ばずにreadyを通知する", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");
    const onChange = vi.fn<(state: AppAccessState) => void>();

    const unsubscribe = subscribeToAppAccessState(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("ready");
    expect(() => unsubscribe()).not.toThrow();
  });
});
