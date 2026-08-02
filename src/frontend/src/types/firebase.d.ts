import type { Firestore } from "firebase/firestore";

declare global {
  /**
   * ユーザー自身のデータへの読み書きが失敗した理由
   * (`src/lib/firebase/user-context.ts`)。
   *
   * 画面に出す文言はドメインごとの定数側で持つ(例: `REAL_ESTATE_FAILURE_MESSAGES`)。
   * 理由の区別まで各ドメインで持つと、同じ失敗に別の名前が付いて扱いが揃わなくなるため、
   * 種類だけをここで共有する。
   */
  type FirestoreAccessFailureReason =
    "signed-out" | "configuration-error" | "permission-denied" | "unknown";

  /** ログイン中のユーザーとFirestoreの組。取り出せなかった場合は理由を返す */
  type FirestoreUserContext =
    | { ok: true; firestore: Firestore; uid: string }
    | { ok: false; reason: FirestoreAccessFailureReason };
}
