import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeToPublicSessionState } from "@/lib/auth/public-session";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth, User } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const onIdTokenChanged = vi.fn<(auth: Auth, observer: (user: User | null) => void) => () => void>();
const getFirebaseAuth = vi.fn<() => Auth>();

vi.mock("firebase/auth", () => ({
  onIdTokenChanged: (auth: Auth, observer: (user: User | null) => void) =>
    onIdTokenChanged(auth, observer),
}));

vi.mock("@/lib/firebase/client", async () => {
  // 設定不足の判定に実装のエラークラスを使うため、そこだけ本物を借りる
  const actual = await vi.importActual<typeof FirebaseClientModule>("@/lib/firebase/client");

  return {
    FirebaseConfigurationError: actual.FirebaseConfigurationError,
    getFirebaseAuth: () => getFirebaseAuth(),
  };
});

const auth = {} as Auth;
const user = { uid: "uid-1" } as User;

describe("subscribeToPublicSessionState", () => {
  beforeEach(() => {
    onIdTokenChanged.mockReset();
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("セッションが無ければsigned-outを通知する", () => {
    onIdTokenChanged.mockImplementation((_auth, observer) => {
      observer(null);
      return () => {};
    });
    const onChange = vi.fn<(state: PublicSessionState) => void>();

    subscribeToPublicSessionState(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("signed-out");
  });

  /**
   * ログイン後画面のガードと違い、メール確認・2FA登録までは見ない。導線を出す判断でしかなく、
   * 手順の途中のセッションには「ダッシュボードへ」を出したほうが続きに戻れる
   * (docs/screen-requirements-public.md 2章)。
   */
  it("メール未確認・2FA未登録のセッションでもsigned-inを通知する", () => {
    onIdTokenChanged.mockImplementation((_auth, observer) => {
      observer({ ...user, emailVerified: false } as User);
      return () => {};
    });
    const onChange = vi.fn<(state: PublicSessionState) => void>();

    subscribeToPublicSessionState(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("signed-in");
  });

  it("認証状態が変わるたびに通知する", () => {
    let notify: ((user: User | null) => void) | undefined;
    onIdTokenChanged.mockImplementation((_auth, observer) => {
      notify = observer;
      return () => {};
    });
    const onChange = vi.fn<(state: PublicSessionState) => void>();

    subscribeToPublicSessionState(onChange);
    notify?.(user);
    notify?.(null);

    expect(onChange.mock.calls).toEqual([["signed-in"], ["signed-out"]]);
  });

  it("購読の解除関数をそのまま返す", () => {
    const unsubscribe = vi.fn();
    onIdTokenChanged.mockReturnValue(unsubscribe);

    subscribeToPublicSessionState(vi.fn())();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  /**
   * この3画面はFirestoreを読まず未ログインのまま完結するため、設定不足で画面ごと止めない
   * (docs/screen-requirements-public.md 2章)。
   */
  it("Firebaseの設定値が足りない場合はsigned-outを通知する", () => {
    getFirebaseAuth.mockImplementation(() => {
      throw new FirebaseConfigurationError("設定値が足りません");
    });
    const onChange = vi.fn<(state: PublicSessionState) => void>();

    const unsubscribe = subscribeToPublicSessionState(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("signed-out");
    expect(() => unsubscribe()).not.toThrow();
  });

  /** 設定不足以外のエラーまで飲み込むと、原因の分からない未ログイン表示になる */
  it("設定不足以外のエラーはそのまま投げる", () => {
    getFirebaseAuth.mockImplementation(() => {
      throw new Error("想定外");
    });

    expect(() => subscribeToPublicSessionState(vi.fn())).toThrow("想定外");
  });

  /** 迂回中はログイン後画面が開ける。導線が「ログイン」のままだと押せる先と食い違う */
  it("開発時の認証ガード迂回が有効なら、Firebaseを呼ばずにsigned-inを通知する", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");
    const onChange = vi.fn<(state: PublicSessionState) => void>();

    const unsubscribe = subscribeToPublicSessionState(onChange);

    expect(onChange).toHaveBeenCalledExactlyOnceWith("signed-in");
    expect(getFirebaseAuth).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });
});
