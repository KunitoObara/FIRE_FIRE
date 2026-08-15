import { httpsCallable } from "firebase/functions";

import { DELETE_ACCOUNT_FUNCTION } from "@/constants/firebase";
import { markAccountDeleted } from "@/lib/auth/account-deleted-notice";
import { toCallableFailureReason } from "@/lib/auth/callable-error";
import { getFirebaseFunctions } from "@/lib/firebase/client";

/**
 * アカウント削除(docs/auth-login-requirements.md 3.11、docs/screen-requirements-account.md B10)。
 *
 * 削除はCloud Functions側で行う。クライアントSDKの`deleteUser`ではFirestoreのサブコレクションを
 * 消せず、`mfaRecoveryCodes`と`signupAllowlist`はセキュリティルールがクライアントからの操作を
 * 全面的に拒否しているため。本人確認(パスワード + 登録メールアドレス)もサーバー側で行う。
 *
 * **成功したらサインアウトは要らない。** ユーザーが消えた時点でIDトークンは更新できなくなり、
 * ガードがA4へ送る。ただし呼び出し元はA0へ置き換えて遷移するため、そこへ着く前に一瞬
 * ログイン画面が挟まらないよう、遷移は呼び出し元が直接行う。
 */

/** バックエンドの`details.reason`として受け付ける値(src/backend/src/account-deletion/functions.ts) */
const DELETE_ACCOUNT_FAILURE_REASONS: readonly AccountDeletionFailureReason[] = [
  "signed-out",
  "password-not-linked",
  "email-mismatch",
  "password-required",
  "invalid-credential",
  "too-many-requests",
  "data-deletion-failed",
  "account-deletion-failed",
];

/**
 * 本人確認のうえ、アカウントと利用者のデータをすべて削除する。
 *
 * 成功した場合は「削除しました」をA0で1回だけ出すためのフラグを立てる。フラグを立てるのは
 * 成功したときだけで、失敗時に立てると削除できていないのに完了を伝えることになる。
 */
export const deleteAccount = async (
  password: string,
  confirmEmail: string,
): Promise<AccountDeletionResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), DELETE_ACCOUNT_FUNCTION);
    await callable({ password, confirmEmail });

    markAccountDeleted();

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        DELETE_ACCOUNT_FAILURE_REASONS,
        "アカウントを削除できませんでした",
      ),
    };
  }
};
