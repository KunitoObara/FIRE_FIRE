import { FirebaseError } from "firebase/app";
import { reload, sendEmailVerification } from "firebase/auth";

import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

import type { Auth } from "firebase/auth";

/** セッションが失われたと見なすFirebaseのエラーコード */
const SESSION_LOST_ERROR_CODES = ["auth/user-token-expired", "auth/user-not-found"];

const isSessionLost = (error: unknown): boolean =>
  error instanceof FirebaseError && SESSION_LOST_ERROR_CODES.includes(error.code);

/** リクエストがFirebaseに届かなかったか */
const isNetworkError = (error: unknown): boolean =>
  error instanceof FirebaseError && error.code === "auth/network-request-failed";

/**
 * 永続化されたセッションの復元を待ってからAuthを返す。
 *
 * Firebase Authはセッションをブラウザ側(既定でIndexedDB)に持つため、
 * 初回描画の時点では`currentUser`がまだnullのことがある。復元前の値で
 * 「セッション無し」と判断してA1へ戻してしまわないよう、必ずここを通す。
 */
const getReadyAuth = async (): Promise<Auth> => {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth;
};

/**
 * メールアドレスの確認状況をFirebaseから取り直す(A2)。
 *
 * `emailVerified`はローカルに保持されたユーザー情報の一部で、確認リンクを別タブ・
 * 別デバイスで開いても自動では更新されない。そのため`reload`でサーバー側の状態を取り込む。
 */
export const reloadEmailVerificationState = async (): Promise<EmailVerificationState> => {
  try {
    const auth = await getReadyAuth();
    const user = auth.currentUser;

    if (user === null) {
      return { status: "signed-out" };
    }

    await reload(user);

    return user.emailVerified
      ? { status: "verified" }
      : { status: "unverified", email: user.email };
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      return { status: "configuration-error" };
    }

    if (isSessionLost(error)) {
      return { status: "signed-out" };
    }

    if (isNetworkError(error)) {
      return { status: "network-error" };
    }

    console.error("メールアドレスの確認状況を取得できませんでした", error);
    return { status: "unknown-error" };
  }
};

const toResendFailure = (error: unknown): ResendVerificationEmailResult => {
  if (error instanceof FirebaseConfigurationError) {
    return { ok: false, reason: "configuration-error" };
  }

  if (isSessionLost(error)) {
    return { ok: false, reason: "no-session" };
  }

  if (error instanceof FirebaseError && error.code === "auth/too-many-requests") {
    return { ok: false, reason: "too-many-requests" };
  }

  if (isNetworkError(error)) {
    return { ok: false, reason: "network-error" };
  }

  console.error("確認メールを再送できませんでした", error);
  return { ok: false, reason: "unknown" };
};

/**
 * 確認メールを再送する(A2「確認メールを再送する」)。
 *
 * 送信対象はサインアップ直後のサインイン状態にある`currentUser`。
 * A1(src/lib/auth/sign-up.ts)が作成後にサインアウトしないのはこのため。
 */
export const resendVerificationEmail = async (): Promise<ResendVerificationEmailResult> => {
  try {
    const auth = await getReadyAuth();
    const user = auth.currentUser;

    if (user === null) {
      return { ok: false, reason: "no-session" };
    }

    await sendEmailVerification(user);
    return { ok: true };
  } catch (error) {
    return toResendFailure(error);
  }
};
