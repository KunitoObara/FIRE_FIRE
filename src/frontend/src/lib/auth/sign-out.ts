import { FirebaseError } from "firebase/app";
import { signOut } from "firebase/auth";

import { markLoggedOut } from "@/lib/auth/logout-notice";
import { clearPendingGoogleLink } from "@/lib/auth/pending-google-link";
import { clearPendingLogin } from "@/lib/auth/pending-login";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * ログアウトを実行する(docs/auth-login-requirements.md 3.9、docs/screen-requirements-account.md 2章)。
 *
 * 共通ヘッダーのユーザーメニューとA2・A3の「別のアカウントでログイン」の両方から呼ぶため、
 * 遷移(A4への置き換え)は含まない。呼び出し元(`LogoutConfirmDialog`)が成功を確認してから
 * `router.replace`する。
 *
 * `clearQueryCache`はTanStack Queryのキャッシュ初期化用のコールバック。共通ヘッダーは
 * `QueryClientProvider`配下にあるため`queryClient.clear()`を渡せるが、A2・A3はまだ
 * Firestoreを一切引いておらず`QueryProvider`の外側のため、その場合は省略してよい。
 *
 * 成功時のみ`clearPendingLogin`・`markLoggedOut`・キャッシュ初期化を行う。失敗時にこれらを
 * 実行すると、サインイン状態が残ったままA5の検証セッションだけ失われる等、中途半端な状態になる。
 */
export const performSignOut = async (clearQueryCache?: () => void): Promise<SignOutResult> => {
  try {
    await signOut(getFirebaseAuth());
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "auth/network-request-failed") {
      return { ok: false, reason: "network-error" };
    }

    console.error("ログアウトに失敗しました", error);
    return { ok: false, reason: "unknown" };
  }

  clearQueryCache?.();
  clearPendingLogin();
  // 連携待ちのGoogle資格情報も破棄する。メモリ上で引き回している認証途中の状態は
  // ログアウトで捨てる方針のため(docs/auth-login-requirements.md 3.9)
  clearPendingGoogleLink();
  markLoggedOut();

  return { ok: true };
};
