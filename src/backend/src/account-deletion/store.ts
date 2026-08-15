import { getFirestore } from "firebase-admin/firestore";

import { normalizeEmail } from "../signup-allowlist/email";

/**
 * アカウント削除に伴うFirestore側の後始末(docs/auth-login-requirements.md 3.11)。
 *
 * 消す先が3つに分かれているのは、保存の理由がそれぞれ違うためである。
 *
 * - `users/{uid}` 配下 — 利用者が入力・取り込んだデータ本体
 * - `mfaRecoveryCodes/{uid}` — 2FAの復旧手段。クライアントからは読み書きできない領域
 * - `signupAllowlist/{メールアドレス}` — 招待の記録。**ドキュメントIDがメールアドレスそのもの**
 *
 * いずれも`firestore.rules`がクライアントからの操作を拒否しているか(後ろ2つ)、
 * サブコレクションの再帰削除がクライアントSDKでは行えない(1つ目)ため、Admin SDKで消す。
 */

/** 利用者のデータ本体の親ドキュメント。実体は配下のサブコレクションにある */
const USERS_COLLECTION = "users";

/** 2FAリカバリーコードのハッシュ。ドキュメントIDはuid(1ユーザー1件) */
const RECOVERY_CODES_COLLECTION = "mfaRecoveryCodes";

/** サインアップ許可リスト。ドキュメントIDは正規化済みのメールアドレスそのもの */
const SIGNUP_ALLOWLIST_COLLECTION = "signupAllowlist";

/**
 * 利用者のデータを消す。
 *
 * **`recursiveDelete`を使う。** `users/{uid}` の配下は
 * `assetSnapshots` / `transactions` / `csvImports` / `categoryAxes` / `debts` / `settings` /
 * `properties` の7つのサブコレクションに分かれており、しかも今後増える。コレクション名を
 * 列挙して消す形にすると、**新しいサブコレクションを足した人がここを直し忘れた分だけ
 * データが消え残る** — 消し残りは画面に出ないため、気付く手立てが無い。親ドキュメントごと
 * 再帰的に消せば、増えたぶんは黙って対象に入る。
 *
 * 親ドキュメント自体は存在しない(`firestore.rules`のコメントのとおり使っていない)が、
 * `recursiveDelete`は実体の無いドキュメントの配下も辿るため、これで足りる。
 */
export const deleteUserData = async (uid: string): Promise<void> => {
  const firestore = getFirestore();

  await firestore.recursiveDelete(firestore.collection(USERS_COLLECTION).doc(uid));
};

/** 2FAリカバリーコードを消す。発行前でも`delete`は成功するので存在確認はしない */
export const deleteRecoveryCodeDocument = async (uid: string): Promise<void> => {
  await getFirestore().collection(RECOVERY_CODES_COLLECTION).doc(uid).delete();
};

/**
 * 招待の記録を消す。
 *
 * **アカウントを消してもここが残ると、Firestoreにメールアドレスだけが残り続ける。**
 * A10 プライバシーポリシーが「取得する情報」にメールアドレスを挙げている以上、削除の求めに
 * 応じるならこちらも消す(PO判断。docs/screen-requirements-public.md A10)。
 * 消したあと同じアドレスで登録し直すには、招待し直しが要る。
 *
 * 照合と同じ`normalizeEmail`を通す。登録時に承認された形と同じIDでなければ消せないため
 * (docs/auth-login-requirements.md 3.10)。空文字になるアドレスは対象が定まらないので何もしない。
 */
export const deleteSignUpAllowlistEntry = async (email: string): Promise<void> => {
  const normalized = normalizeEmail(email);

  if (normalized === "") {
    return;
  }

  await getFirestore().collection(SIGNUP_ALLOWLIST_COLLECTION).doc(normalized).delete();
};
