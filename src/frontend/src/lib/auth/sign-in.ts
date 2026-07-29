import { FirebaseError } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getMultiFactorResolver,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { setPendingLogin } from "@/lib/auth/pending-login";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

import type { MultiFactorError } from "firebase/auth";

/**
 * 2FAの確認コード入力が必要な状態か。
 * 一次認証は通過しているため、失敗ではなくA5へ進む合図として扱う。
 */
const isMultiFactorRequired = (error: unknown): error is MultiFactorError =>
  error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required";

/**
 * 「ログイン状態を保持する」の選択をFirebase Authの永続化方式に対応付ける。
 *
 * - 保持する: ブラウザを閉じてもセッションが残る(既定のIndexedDB保存)
 * - 保持しない: タブを閉じるとセッションが切れる
 */
const persistenceFor = (rememberMe: boolean) =>
  rememberMe ? browserLocalPersistence : browserSessionPersistence;

const toFailureReason = (error: unknown): SignInFailureReason => {
  // 設定不足は通信エラーと区別し、対処法を画面に出せるようにする
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    // 資格情報の誤りは区別せず1つにまとめる。どれが返るかはIdentity Platform側の
    // メール列挙保護の設定で変わり、出し分けると未登録のアドレスを外部から判定できてしまう。
    // `auth/invalid-email`もここに含める(送信前にzodで形式を検証済みのため)
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "invalid-credential";
    case "auth/user-disabled":
      return "user-disabled";
    case "auth/too-many-requests":
      return "too-many-requests";
    // ローカル開発ではAuthエミュレータ未起動が主な原因になる
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

/**
 * メールアドレス・パスワードで一次認証を行う(A4「ログイン」)。
 *
 * サインアップと同じくクライアント実行とする理由は`sign-up.ts`のコメントを参照。
 *
 * 2FAが登録済みのユーザーでは`signInWithEmailAndPassword`は成功せず、
 * `auth/multi-factor-auth-required`が投げられる。これは失敗ではなく一次認証の通過を意味するため、
 * A5が確認コードの検証に使う`MultiFactorResolver`を`pending-login`へ預けたうえで
 * `next: "mfa-verify"`を返す。
 *
 * そのまま成功するのは2FA未登録のアカウント(サインアップの途中で離脱した場合)に限られる。
 * 2FAは全ユーザー必須(docs/auth-login-requirements.md 3.3)のため、未完了の手順へ戻す。
 */
export const signInWithEmail = async (
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<SignInResult> => {
  try {
    // 設定値が不足していると`FirebaseConfigurationError`を投げる。これも
    // `configuration-error`として画面に返したいので、取得はtryの中に置く
    const auth = getFirebaseAuth();

    // セッションの保存先は資格情報を渡す前に確定させる必要がある。
    // 2FAありの場合に実際にセッションが作られるのはA5の検証成功時だが、
    // 設定はAuthインスタンスに残るためここで一度指定すれば足りる
    await setPersistence(auth, persistenceFor(rememberMe));

    const credential = await signInWithEmailAndPassword(auth, email, password);

    // メール未確認でもFirebaseはログイン自体を通すため、確認状況は成功後に見る
    if (!credential.user.emailVerified) {
      return { ok: true, next: "email-unverified" };
    }

    return { ok: true, next: "mfa-setup" };
  } catch (error) {
    if (isMultiFactorRequired(error)) {
      setPendingLogin({
        // ここに来た時点でAuthの取得は成功している。生成済みのインスタンスが返る
        resolver: getMultiFactorResolver(getFirebaseAuth(), error),
        // resolverは2要素目のヒントしか持たないため、A5の確認表示には入力値を使う
        email,
        rememberMe,
      });
      return { ok: true, next: "mfa-verify" };
    }

    const reason = toFailureReason(error);
    // `user-disabled`はここでログに出さない。画面表示を資格情報の誤りと揃えている意図
    // (constants/auth.ts参照)に対して、コンソールが抜け道に見えてしまうため。
    // 原因を切り分けたいときは、開発者ツールのネットワークタブでFirebaseの応答を見る
    if (reason === "unknown") {
      console.error("ログインに失敗しました", error);
    }
    return { ok: false, reason };
  }
};
