import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { ASSET_TYPE_SCAN_LIMIT } from "@/constants/asset-categories";
import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/lib/firebase/client";
import {
  assetSnapshotAssetTypesSchema,
  categoryAxisDocumentSchema,
} from "@/schemas/asset-categories";

import type { Firestore } from "firebase/firestore";

/**
 * 分類軸(B4 資産分類マスタ設定画面)のFirestore入出力。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 書き込みもクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/categoryAxes/{axisId}   ユーザーが登録した分類軸
 * users/{uid}/assetSnapshots/{date}   B2で取り込んだ資産残高(集計対象の選択肢の元)
 * ```
 */

const CATEGORY_AXES_COLLECTION = "categoryAxes";
const ASSET_SNAPSHOTS_COLLECTION = "assetSnapshots";
const USERS_COLLECTION = "users";

const categoryAxesRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, CATEGORY_AXES_COLLECTION);

const assetSnapshotsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, ASSET_SNAPSHOTS_COLLECTION);

/**
 * ログイン中のユーザーとFirestoreをまとめて取り出す。
 * 未ログイン・設定不足はここで理由に変換し、呼び出し側では例外を扱わない。
 */
const resolveContext = ():
  | { ok: true; firestore: Firestore; uid: string }
  | { ok: false; reason: AssetCategoryFailureReason } => {
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
const toFailureReason = (error: unknown): AssetCategoryFailureReason => {
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

/**
 * 登録済みの分類軸を登録順(古い順)に取得する。
 *
 * 登録順のインデックスがそのまま分類別内訳の色スロットに対応するため
 * (DESIGN.md 3章)、並び順は`createdAt`の昇順に固定する。
 */
export const fetchCategoryAxes = async (): Promise<
  | { ok: true; axes: AssetCategoryAxisDocument[] }
  | { ok: false; reason: AssetCategoryFailureReason }
> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(categoryAxesRef(context.firestore, context.uid), orderBy("createdAt", "asc")),
    );

    const axes = snapshot.docs.flatMap((document) => {
      const parsed = categoryAxisDocumentSchema.safeParse(document.data());

      if (!parsed.success) {
        console.error("分類軸を解釈できませんでした", document.id, parsed.error.issues);
        return [];
      }

      const { createdAt, ...rest } = parsed.data;

      return [{ id: document.id, ...rest, createdAt: createdAt?.toDate().toISOString() ?? null }];
    });

    return { ok: true, axes };
  } catch (error) {
    console.error("分類軸を取得できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};

/**
 * 集計対象チェックボックスの選択肢にする、既知の資産種別名を取得する。
 *
 * 資産種別は口座単位ではなくB2 CSV取込のマネーフォワード「資産推移」エクスポートの列名
 * (`預金・現金`・`株式(現物)`等)に対応する。専用のマスタは無く、実際に取り込んだ
 * `assetSnapshots`の`byType`のキーの和集合をその場で集計する。
 *
 * 走査件数は`ASSET_TYPE_SCAN_LIMIT`で打ち切る。資産残高は1日1行なので、
 * 個人利用の規模ではこの上限に収まる。
 */
export const fetchAssetTypeOptions = async (): Promise<AssetTypeOptionsResult> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(assetSnapshotsRef(context.firestore, context.uid), limit(ASSET_TYPE_SCAN_LIMIT)),
    );

    const assetTypeNames = new Set<string>();

    for (const document of snapshot.docs) {
      const parsed = assetSnapshotAssetTypesSchema.safeParse(document.data());

      if (!parsed.success) {
        console.error("資産残高を解釈できませんでした", document.id, parsed.error.issues);
        continue;
      }

      for (const name of Object.keys(parsed.data.byType)) {
        assetTypeNames.add(name);
      }
    }

    return {
      ok: true,
      assetTypeNames: [...assetTypeNames].sort((left, right) => left.localeCompare(right, "ja")),
    };
  } catch (error) {
    console.error("資産種別の選択肢を取得できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};

/** 分類軸を新規登録する */
export const createCategoryAxis = async (
  values: AssetCategoryAxisFormValues,
): Promise<SaveCategoryAxisResult> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    await addDoc(categoryAxesRef(context.firestore, context.uid), {
      name: values.name,
      assetTypeNames: values.assetTypeNames,
      createdAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (error) {
    console.error("分類軸を登録できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};

/**
 * 分類軸を更新する。
 *
 * `createdAt`は更新の対象にしない。登録順が色スロットの割り当てに使われており、
 * 編集のたびに繰り上がると既存の分類の色が変わってしまうため(DESIGN.md 3章)。
 */
export const updateCategoryAxis = async (
  id: string,
  values: AssetCategoryAxisFormValues,
): Promise<SaveCategoryAxisResult> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    await updateDoc(doc(categoryAxesRef(context.firestore, context.uid), id), {
      name: values.name,
      assetTypeNames: values.assetTypeNames,
    });

    return { ok: true };
  } catch (error) {
    console.error("分類軸を更新できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};

/**
 * 分類軸を削除する。
 *
 * 集計対象が1件以上割り当てられた分類は`firestore.rules`側でも削除を拒否しており
 * (先に編集で割り当てを解除する必要がある)、呼び出し側は`permission-denied`として受け取る。
 * 実際の禁止判定は画面側で`assetTypeNames`の件数から先に行い、確認ダイアログの時点で
 * ブロックする(この関数まで進むのは削除可能な分類のときだけ)。
 */
export const deleteCategoryAxis = async (id: string): Promise<DeleteCategoryAxisResult> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    await deleteDoc(doc(categoryAxesRef(context.firestore, context.uid), id));
    return { ok: true };
  } catch (error) {
    console.error("分類軸を削除できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};
