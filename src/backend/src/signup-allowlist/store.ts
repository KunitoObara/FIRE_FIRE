import { getFirestore } from "firebase-admin/firestore";

import { normalizeEmail } from "./email";

/**
 * サインアップ許可リストの読み取り(docs/auth-login-requirements.md 3.10)。
 *
 * クライアントからの読み書きは`firestore.rules`で全面的に拒否しており、この領域に触れるのは
 * Admin SDKを使うCloud Functionsだけ(`mfaRecoveryCodes`と同じ扱い)。承認の操作は開発者が
 * コンソールでドキュメントを1件足すことで行い、アプリ側に管理画面は設けない。
 */

/**
 * 保存先コレクション。
 *
 * **ドキュメントIDは正規化済みのメールアドレスそのもの**とし、存在すること自体を「承認済み」の
 * 印とする。中身のフィールドは判定に使わない。
 *
 * この形にしたのは、判定が**ドキュメント1件の取得**で済むためである。Blocking Functionsには
 * 実行時間の上限があり(3.6でHTTP呼び出しを5秒で打ち切っているのと同じ制約)、コレクションを
 * 走査する形やクエリを投げる形は避けたい。1件のドキュメントに配列で持つ形も同じ読み取り数だが、
 * コンソールでの追加が配列の編集になり、承認という日常の操作が重くなる。
 *
 * メールアドレスをIDにできるのは、FirestoreのドキュメントIDが禁じている文字(`/`)を
 * メールアドレスが含まないため。このコレクションはクライアントから読めないので、
 * IDに素のアドレスが出ることによる漏洩も無い。
 */
const SIGNUP_ALLOWLIST_COLLECTION = "signupAllowlist";

/**
 * 承認済みのメールアドレスかどうかを返す。
 *
 * **例外を握り潰さない。** 読み取りに失敗したときは呼び出し側(`functions.ts`)が拒否側へ倒す
 * ため、ここで`false`に丸めると「承認されていない」と「確かめられなかった」の区別が消え、
 * ログから原因を追えなくなる。
 */
export const isSignUpAllowed = async (email: string): Promise<boolean> => {
  const normalized = normalizeEmail(email);

  if (normalized === "") {
    return false;
  }

  const snapshot = await getFirestore()
    .collection(SIGNUP_ALLOWLIST_COLLECTION)
    .doc(normalized)
    .get();

  return snapshot.exists;
};
