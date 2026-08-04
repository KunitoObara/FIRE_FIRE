import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearGoogleLinkFailureNotice, wasGoogleLinkFailed } from "@/lib/auth/google-link-notice";
import { linkPendingGoogleAccount, signInWithGoogle } from "@/lib/auth/google-sign-in";
import {
  clearPendingGoogleLink,
  getPendingGoogleLink,
  setPendingGoogleLink,
} from "@/lib/auth/pending-google-link";
import { clearPendingLogin, getPendingLogin } from "@/lib/auth/pending-login";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type {
  Auth,
  MultiFactorResolver,
  OAuthCredential,
  User,
  UserCredential,
} from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

// `Auth.currentUser`は読み取り専用のため、テストからはこの変数を差し替えて出し分ける
let currentUser: User | null = null;
const auth = {
  get currentUser(): User | null {
    return currentUser;
  },
} as Auth;
const resolver = {} as MultiFactorResolver;
const googleCredential = {} as OAuthCredential;

const getFirebaseAuth = vi.fn<() => Auth>();
const setPersistence = vi.fn<(auth: Auth, persistence: unknown) => Promise<void>>();
const signInWithPopup = vi.fn<(auth: Auth, provider: unknown) => Promise<UserCredential>>();
const linkWithCredential = vi.fn<(user: User, credential: OAuthCredential) => Promise<unknown>>();
const credentialFromError = vi.fn<(error: unknown) => OAuthCredential | null>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "browserLocalPersistence",
  browserSessionPersistence: "browserSessionPersistence",
  GoogleAuthProvider: class {
    static credentialFromError = (error: unknown): OAuthCredential | null =>
      credentialFromError(error);
  },
  getMultiFactorResolver: () => resolver,
  linkWithCredential: (user: User, credential: OAuthCredential) =>
    linkWithCredential(user, credential),
  setPersistence: (auth: Auth, persistence: unknown) => setPersistence(auth, persistence),
  signInWithPopup: (auth: Auth, provider: unknown) => signInWithPopup(auth, provider),
}));

/** ポップアップが成功したときのFirebaseの戻り値。emailVerifiedだけが判断に効く */
const credentialWith = (emailVerified: boolean): UserCredential =>
  ({ user: { emailVerified } }) as UserCredential;

/** Firebaseが`customData`に値を載せて投げるエラー */
const authError = (code: string, email?: string): FirebaseError => {
  const error = new FirebaseError(code, "");
  Object.assign(error, { customData: { appName: "[DEFAULT]", email } });
  return error;
};

describe("signInWithGoogle", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    setPersistence.mockReset();
    setPersistence.mockResolvedValue(undefined);
    signInWithPopup.mockReset();
    signInWithPopup.mockResolvedValue(credentialWith(true));
    credentialFromError.mockReset();
    credentialFromError.mockReturnValue(googleCredential);
    linkWithCredential.mockReset();
    linkWithCredential.mockResolvedValue({});
    currentUser = null;
    clearPendingLogin();
    clearPendingGoogleLink();
    clearGoogleLinkFailureNotice();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("ポップアップの成功", () => {
    // GoogleのメールアドレスはGoogle側で確認済みのため、新規作成でもA2は挟まない
    it("2FA未登録のアカウントはA3へ進む", async () => {
      await expect(signInWithGoogle(true)).resolves.toEqual({ ok: true, next: "mfa-setup" });
    });

    it("「ログイン状態を保持する」の選択を資格情報を渡す前に反映する", async () => {
      await signInWithGoogle(false);

      expect(setPersistence).toHaveBeenCalledWith(auth, "browserSessionPersistence");
      expect(setPersistence.mock.invocationCallOrder[0]).toBeLessThan(
        signInWithPopup.mock.invocationCallOrder[0],
      );
    });

    // 通常は起こらないが、A4からの経路と遷移先の判断を揃えている
    it("メール未確認ならA2へ戻す", async () => {
      signInWithPopup.mockResolvedValue(credentialWith(false));

      await expect(signInWithGoogle(true)).resolves.toEqual({
        ok: true,
        next: "email-unverified",
      });
    });
  });

  describe("2FA登録済み", () => {
    beforeEach(() => {
      signInWithPopup.mockRejectedValue(
        authError("auth/multi-factor-auth-required", "user@example.com"),
      );
    });

    it("検証セッションを預けてA5へ進む", async () => {
      await expect(signInWithGoogle(false)).resolves.toEqual({ ok: true, next: "mfa-verify" });

      expect(getPendingLogin()).toEqual({
        resolver,
        email: "user@example.com",
        rememberMe: false,
      });
    });

    // A5の「リカバリーコードを使う」はサーバー側でのパスワード再確認を伴うため、
    // パスワードを持たないGoogleログインでは導線を出させない
    it("パスワードは預けない", async () => {
      await signInWithGoogle(true);

      expect(getPendingLogin()?.password).toBeUndefined();
    });

    // A5は宛名を伏せた案内に切り替える
    it("エラーにメールアドレスが載っていなければ空文字で預ける", async () => {
      signInWithPopup.mockRejectedValue(authError("auth/multi-factor-auth-required"));

      await signInWithGoogle(true);

      expect(getPendingLogin()?.email).toBe("");
    });
  });

  describe("同一メールアドレスのパスワードアカウントが既にある", () => {
    beforeEach(() => {
      signInWithPopup.mockRejectedValue(
        authError("auth/account-exists-with-different-credential", "user@example.com"),
      );
    });

    it("連携待ちの資格情報を預けてA8へ進む", async () => {
      await expect(signInWithGoogle(true)).resolves.toEqual({ ok: true, next: "link-account" });

      expect(getPendingGoogleLink()).toEqual({
        credential: googleCredential,
        email: "user@example.com",
        rememberMe: true,
      });
    });

    // A8でできることが無いため、連携待ちを預けずログインからやり直してもらう
    it("資格情報を取り出せなければ失敗として返す", async () => {
      credentialFromError.mockReturnValue(null);

      await expect(signInWithGoogle(true)).resolves.toEqual({ ok: false, reason: "unknown" });
      expect(getPendingGoogleLink()).toBeNull();
    });

    it("メールアドレスが載っていなければ失敗として返す", async () => {
      signInWithPopup.mockRejectedValue(authError("auth/account-exists-with-different-credential"));

      await expect(signInWithGoogle(true)).resolves.toEqual({ ok: false, reason: "unknown" });
      expect(getPendingGoogleLink()).toBeNull();
    });
  });

  describe("失敗", () => {
    it.each([
      ["auth/popup-closed-by-user", "popup-closed"],
      ["auth/cancelled-popup-request", "popup-closed"],
      ["auth/user-cancelled", "popup-closed"],
      ["auth/popup-blocked", "popup-blocked"],
      ["auth/operation-not-allowed", "provider-disabled"],
      ["auth/unauthorized-domain", "unauthorized-domain"],
      ["auth/user-disabled", "user-disabled"],
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s を %s として返す", async (code, reason) => {
      signInWithPopup.mockRejectedValue(new FirebaseError(code, ""));

      await expect(signInWithGoogle(true)).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定不足を通信エラーと区別する", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(signInWithGoogle(true)).resolves.toEqual({
        ok: false,
        reason: "configuration-error",
      });
    });
  });

  // モジュールスコープの変数はSPA遷移では消えないため、やり直しのたびに捨てる
  it("試行のたびに前回の検証待ち・連携待ちを捨てる", async () => {
    setPendingGoogleLink({
      credential: googleCredential,
      email: "old@example.com",
      rememberMe: true,
    });

    await signInWithGoogle(true);

    expect(getPendingGoogleLink()).toBeNull();
  });
});

describe("linkPendingGoogleAccount", () => {
  const user = { email: "user@example.com" } as User;

  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    linkWithCredential.mockReset();
    linkWithCredential.mockResolvedValue({});
    currentUser = user;
    clearPendingGoogleLink();
    clearGoogleLinkFailureNotice();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("預かった資格情報をサインイン済みのアカウントへ連携する", async () => {
    setPendingGoogleLink({
      credential: googleCredential,
      email: "user@example.com",
      rememberMe: true,
    });

    await linkPendingGoogleAccount();

    expect(linkWithCredential).toHaveBeenCalledWith(user, googleCredential);
    expect(wasGoogleLinkFailed()).toBe(false);
    // 使い終わった資格情報は次のログインに紛れ込ませない
    expect(getPendingGoogleLink()).toBeNull();
  });

  // A5は通常のログインでも通るため、経路を判定せず呼べる必要がある
  it("連携待ちが無ければ何もしない", async () => {
    await linkPendingGoogleAccount();

    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(wasGoogleLinkFailed()).toBe(false);
  });

  // サインイン自体は成立しているためログインは取り消さず、B1の通知に回す
  it("連携に失敗したらB1の通知フラグを立て、資格情報は捨てる", async () => {
    setPendingGoogleLink({
      credential: googleCredential,
      email: "user@example.com",
      rememberMe: true,
    });
    linkWithCredential.mockRejectedValue(new FirebaseError("auth/credential-already-in-use", ""));

    await linkPendingGoogleAccount();

    expect(wasGoogleLinkFailed()).toBe(true);
    expect(getPendingGoogleLink()).toBeNull();
  });

  // A8を離脱したあと別のアカウントでログインすると連携待ちだけが残る。無条件に連携すると、
  // A8で本人確認を通していないアカウントにGoogleの資格情報が付いてしまう
  it("サインイン中のアカウントのメールアドレスが一致しなければ連携しない", async () => {
    setPendingGoogleLink({
      credential: googleCredential,
      email: "other@example.com",
      rememberMe: true,
    });

    await linkPendingGoogleAccount();

    expect(linkWithCredential).not.toHaveBeenCalled();
    // 連携を試みたのは今サインインした人ではないため、B1の通知も出さない
    expect(wasGoogleLinkFailed()).toBe(false);
    expect(getPendingGoogleLink()).toBeNull();
  });

  // Firebaseはメールアドレスを小文字で保持するとは限らない。大小の違いで弾かない
  it("メールアドレスの大文字小文字は区別せず連携する", async () => {
    setPendingGoogleLink({
      credential: googleCredential,
      email: "User@Example.com",
      rememberMe: true,
    });

    await linkPendingGoogleAccount();

    expect(linkWithCredential).toHaveBeenCalledWith(user, googleCredential);
  });

  it("サインイン済みのアカウントが無ければ通知フラグを立てる", async () => {
    currentUser = null;
    setPendingGoogleLink({
      credential: googleCredential,
      email: "user@example.com",
      rememberMe: true,
    });

    await linkPendingGoogleAccount();

    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(wasGoogleLinkFailed()).toBe(true);
  });
});
