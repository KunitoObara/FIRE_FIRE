import { FirebaseError } from "firebase/app";

import { FirebaseConfigurationError } from "@/lib/firebase/client";

/**
 * メール内リンクのワンタイムコード(oobCode)を扱うAPIの失敗理由を、画面が出し分ける区分へ変換する。
 *
 * パスワード再設定(A7)とメールアドレス確認(`mode=verifyEmail`)で共通に使う。どちらも
 * 「リンクが使えるかどうか」が唯一の分かれ目で、利用者から見た対処も同じであるため。
 */
export const toActionCodeFailureReason = (error: unknown): ActionCodeFailureReason => {
  // 設定不足は通信エラーと区別し、対処法を画面に出せるようにする
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    // 期限切れ・形式不正・使用済みはいずれも「リンクを取り直す」しかなく、区別しても対処が変わらない。
    // アカウントが削除済み(`user-not-found`)の場合も、利用者にできることは同じなのでまとめる
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
    case "auth/user-not-found":
      return "invalid-action-code";
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
