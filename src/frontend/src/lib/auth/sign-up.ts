import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

import { detectSignUpBlockedReason } from "@/lib/auth/signup-allowlist-error";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

const toFailureReason = (error: unknown): SignUpFailureReason => {
  // 設定不足は通信エラーと区別し、対処法を画面に出せるようにする
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  // ベータ期間中のサインアップ制限による拒否(docs/auth-login-requirements.md 3.10)。
  // `error.code`は`auth/internal-error`にしかならず他の内部エラーと区別が付かないため、
  // コードでの分岐より先に判定する
  const blockedReason = detectSignUpBlockedReason(error);
  if (blockedReason !== null) {
    return blockedReason === "not-allowed" ? "signup-not-allowed" : "signup-check-unavailable";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "email-already-in-use";
    case "auth/invalid-email":
      return "invalid-email";
    // Identity Platform側のパスワードポリシーで弾かれた場合
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "password-policy-violation";
    case "auth/too-many-requests":
      return "too-many-requests";
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

/**
 * メールアドレス・パスワードでアカウントを作成し、確認メールを送信する。
 *
 * ミューテーションはServer Actionsを第一候補とする方針(docs/CODING_STANDARDS.md 2章)の例外。
 * Firebase Authは認証セッションをブラウザ側で保持する必要があり、TECH_STACK.md 2章のとおり
 * Authへのアクセスはクライアントの `firebase` SDK が担うため、ここはクライアント実行とする。
 *
 * 作成成功後はそのままサインイン状態になる。A2の確認メール再送は`currentUser`を必要とするため、
 * ここでサインアウトはしない。
 */
export const signUpWithEmail = async (email: string, password: string): Promise<SignUpResult> => {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    return { ok: true };
  } catch (error) {
    const reason = toFailureReason(error);
    if (reason === "unknown") {
      console.error("サインアップに失敗しました", error);
    }
    return { ok: false, reason };
  }
};
