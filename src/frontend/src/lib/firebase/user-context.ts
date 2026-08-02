import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/lib/firebase/client";

/**
 * ユーザー自身のデータを読み書きするリポジトリが共通で必要とする前処理。
 *
 * Firestoreへの書き込みはクライアントSDKから直接行うため(CODING_STANDARDS.md 2章)、
 * どのリポジトリも「ログイン中の`uid`を取り出す」「例外を画面に出せる理由に読み替える」の
 * 2つを最初に行うことになる。B2 CSV取込・B4 資産分類マスタ・B5〜B7 不動産で同じ処理を
 * 持っていたため、ここに集約している。
 */

/**
 * ログイン中のユーザーとFirestoreをまとめて取り出す。
 * 未ログイン・設定不足はここで理由に変換し、呼び出し側では例外を扱わない。
 */
export const resolveFirestoreUserContext = (): FirestoreUserContext => {
  try {
    const { currentUser } = getFirebaseAuth();

    if (currentUser === null) {
      return { ok: false, reason: "signed-out" };
    }

    return { ok: true, firestore: getFirebaseFirestore(), uid: currentUser.uid };
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      return { ok: false, reason: "configuration-error" };
    }

    console.error("Firestoreに接続できませんでした", error);
    return { ok: false, reason: "unknown" };
  }
};

/** Firestoreが投げたエラーを画面用の理由に読み替える */
export const toFirestoreFailureReason = (error: unknown): FirestoreAccessFailureReason => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "permission-denied"
  ) {
    return "permission-denied";
  }

  return "unknown";
};
