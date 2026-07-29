import { FirebaseError } from "firebase/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumePendingLogin, setPendingLogin } from "@/lib/auth/pending-login";
import { signInWithEmail } from "@/lib/auth/sign-in";
import { FirebaseConfigurationError } from "@/lib/firebase/client";

import type { Auth, MultiFactorResolver, UserCredential } from "firebase/auth";

import type * as FirebaseClientModule from "@/lib/firebase/client";

const auth = {} as Auth;
const resolver = {} as MultiFactorResolver;

const getFirebaseAuth = vi.fn<() => Auth>();
const setPersistence = vi.fn<(auth: Auth, persistence: unknown) => Promise<void>>();
const signInWithEmailAndPassword =
  vi.fn<(auth: Auth, email: string, password: string) => Promise<UserCredential>>();

// 実際のクラスは`instanceof`判定に使うため、差し替えるのは関数だけにする
vi.mock("@/lib/firebase/client", async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseClientModule>()),
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: "browserLocalPersistence",
  browserSessionPersistence: "browserSessionPersistence",
  setPersistence: (auth: Auth, persistence: unknown) => setPersistence(auth, persistence),
  signInWithEmailAndPassword: (auth: Auth, email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password),
  getMultiFactorResolver: () => resolver,
}));

/** 一次認証が成功したときのFirebaseの戻り値。emailVerifiedだけが判断に効く */
const credentialWith = (emailVerified: boolean): UserCredential =>
  ({ user: { emailVerified } }) as UserCredential;

/** 2FA登録済みのときにFirebaseが投げるエラー */
const multiFactorRequired = new FirebaseError("auth/multi-factor-auth-required", "");

const signIn = (rememberMe = true): Promise<SignInResult> =>
  signInWithEmail("user@example.com", "Passw0rd!", rememberMe);

describe("signInWithEmail", () => {
  beforeEach(() => {
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue(auth);
    setPersistence.mockReset();
    setPersistence.mockResolvedValue(undefined);
    signInWithEmailAndPassword.mockReset();
    signInWithEmailAndPassword.mockResolvedValue(credentialWith(true));
    consumePendingLogin();
  });

  describe("一次認証の通過後に進む先", () => {
    it("2FA登録済みなら2FA検証へ進み、resolverを預ける", async () => {
      signInWithEmailAndPassword.mockRejectedValue(multiFactorRequired);

      await expect(signIn()).resolves.toEqual({ ok: true, next: "mfa-verify" });
      expect(consumePendingLogin()).toEqual({
        resolver,
        email: "user@example.com",
        rememberMe: true,
      });
    });

    it("メールアドレスが未確認ならメール確認待ちへ戻す", async () => {
      signInWithEmailAndPassword.mockResolvedValue(credentialWith(false));

      await expect(signIn()).resolves.toEqual({ ok: true, next: "email-unverified" });
    });

    it("メール確認済みで2FA未登録なら2FA登録へ戻す", async () => {
      await expect(signIn()).resolves.toEqual({ ok: true, next: "mfa-setup" });
    });
  });

  describe("検証待ちの持ち越し", () => {
    it("試行のたびに前回の検証待ちを捨てる", async () => {
      setPendingLogin({ resolver, email: "previous@example.com", rememberMe: false });

      // 2FA未登録のアカウントでログインし直すと、A5へ進まないまま前回の分が残り得る
      await signIn();

      expect(consumePendingLogin()).toBeNull();
    });

    it("ログインに失敗したときも前回の検証待ちを残さない", async () => {
      setPendingLogin({ resolver, email: "previous@example.com", rememberMe: false });
      signInWithEmailAndPassword.mockRejectedValue(
        new FirebaseError("auth/invalid-credential", ""),
      );

      await signIn();

      expect(consumePendingLogin()).toBeNull();
    });
  });

  describe("「ログイン状態を保持する」", () => {
    it("保持するときはブラウザを閉じても残る方式にする", async () => {
      await signIn(true);

      expect(setPersistence).toHaveBeenCalledWith(auth, "browserLocalPersistence");
    });

    it("保持しないときはタブを閉じると切れる方式にする", async () => {
      await signIn(false);

      expect(setPersistence).toHaveBeenCalledWith(auth, "browserSessionPersistence");
    });

    it("資格情報を渡す前に永続化方式を確定させる", async () => {
      const order: string[] = [];
      setPersistence.mockImplementation(async () => {
        order.push("setPersistence");
      });
      signInWithEmailAndPassword.mockImplementation(async () => {
        order.push("signIn");
        return credentialWith(true);
      });

      await signIn();

      expect(order).toEqual(["setPersistence", "signIn"]);
    });
  });

  describe("失敗理由の変換", () => {
    it.each([
      ["auth/invalid-credential", "invalid-credential"],
      ["auth/invalid-login-credentials", "invalid-credential"],
      ["auth/wrong-password", "invalid-credential"],
      // 未登録のメールアドレスも資格情報の誤りに寄せ、存在の有無を伝えない
      ["auth/user-not-found", "invalid-credential"],
      ["auth/invalid-email", "invalid-credential"],
      ["auth/user-disabled", "user-disabled"],
      ["auth/too-many-requests", "too-many-requests"],
      ["auth/network-request-failed", "network-error"],
      ["auth/internal-error", "unknown"],
    ])("%s は %s として返す", async (code, reason) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      signInWithEmailAndPassword.mockRejectedValue(new FirebaseError(code, ""));

      await expect(signIn()).resolves.toEqual({ ok: false, reason });
    });

    it("Firebaseの設定値が不足しているときは設定不足として返す", async () => {
      getFirebaseAuth.mockImplementation(() => {
        throw new FirebaseConfigurationError("設定値が不足しています");
      });

      await expect(signIn()).resolves.toEqual({ ok: false, reason: "configuration-error" });
    });
  });
});
