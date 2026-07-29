import { browserLocalPersistence, browserSessionPersistence } from "firebase/auth";

import type { Persistence } from "firebase/auth";

/**
 * 「ログイン状態を保持する」の選択をFirebase Authのセッション永続化方式に対応付ける。
 *
 * - 保持する: ブラウザを閉じてもセッションが残る(既定のIndexedDB保存)
 * - 保持しない: タブを閉じるとセッションが切れる
 *
 * 選択するのはA4だが、2FAありのログインで実際にセッションが作られるのはA5の検証成功時のため、
 * A5もこの選択を引き継ぐ(docs/screen-requirements-auth.md A4の注記)。両画面から使うためここに置く。
 */
export const persistenceFor = (rememberMe: boolean): Persistence =>
  rememberMe ? browserLocalPersistence : browserSessionPersistence;
