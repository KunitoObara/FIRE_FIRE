import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";

import { FIRESTORE_BATCH_LIMIT, IMPORT_HISTORY_LIMIT } from "@/constants/csv-import";
import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseFirestore,
} from "@/lib/firebase/client";

import type { Firestore } from "firebase/firestore";

/**
 * 資産残高推移データのFirestore入出力(B2 CSV取込)。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 書き込みもクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/assetSnapshots/{yyyy-MM-dd}   日付をドキュメントIDにして再取込は上書き
 * users/{uid}/csvImports/{importId}         直近の取込履歴
 * ```
 */

const ASSET_SNAPSHOTS_COLLECTION = "assetSnapshots";
const CSV_IMPORTS_COLLECTION = "csvImports";
const USERS_COLLECTION = "users";

/** 資産残高スナップショットのコレクション参照 */
const assetSnapshotsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, ASSET_SNAPSHOTS_COLLECTION);

/** 取込履歴のコレクション参照 */
const csvImportsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, CSV_IMPORTS_COLLECTION);

/**
 * ログイン中のユーザーとFirestoreをまとめて取り出す。
 * 未ログイン・設定不足はここで理由に変換し、呼び出し側では例外を扱わない。
 */
const resolveContext = ():
  | { ok: true; firestore: Firestore; uid: string }
  | { ok: false; reason: CsvImportFailureReason } => {
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
const toFailureReason = (error: unknown): CsvImportFailureReason => {
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

/** 500件ずつに区切る。`writeBatch`が1回で扱える書き込みの上限に合わせる */
const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_unused, index) =>
    items.slice(index * size, (index + 1) * size),
  );

/**
 * 取り込もうとしている日付のうち、既にFirestoreにあるものを数える。
 *
 * 「上書きする」挙動を実行前にユーザーへ見せるためのもの(プレビューの新規/更新件数)。
 * CSVの期間内に限って引くので、蓄積が増えても読む件数は取込対象の期間に比例するだけで済む。
 */
export const buildImportPlan = async (
  parsed: AssetBalanceParsed,
): Promise<
  { ok: true; plan: AssetBalanceImportPlan } | { ok: false; reason: CsvImportFailureReason }
> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(
        assetSnapshotsRef(context.firestore, context.uid),
        where("date", ">=", parsed.periodFrom),
        where("date", "<=", parsed.periodTo),
      ),
    );
    const existingDates = new Set(snapshot.docs.map((document) => document.id));
    const updatedCount = parsed.rows.filter((row) => existingDates.has(row.date)).length;

    return {
      ok: true,
      plan: { newCount: parsed.rows.length - updatedCount, updatedCount },
    };
  } catch (error) {
    console.error("既存の資産残高を照会できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};

/**
 * パース済みの資産残高をFirestoreへ反映し、取込履歴を1件残す。
 *
 * 同じ日付のドキュメントは`merge`せず丸ごと置き換える。前回の取込にしか無かった資産種別が
 * 残っていると、その日の内訳が実際の保有状況とずれるため。
 *
 * `writeBatch`は1回に500件までなので、それを超える取込は複数回に分けて確定する。
 * Firestoreには複数バッチをまたぐトランザクションが無く、途中で失敗するとそれまでの
 * バッチは確定したまま残る。呼び出し側が「全部失敗した」と誤って伝えないよう、
 * 失敗時も反映済みの件数を返す。同じ日付は上書きなので、取り込み直せば必ず揃う。
 */
export const importAssetBalances = async (
  parsed: AssetBalanceParsed,
  fileName: string,
): Promise<AssetBalanceImportResult> => {
  const context = resolveContext();

  if (!context.ok) {
    return { ...context, writtenCount: 0 };
  }

  const { firestore, uid } = context;
  let writtenCount = 0;

  try {
    for (const rows of chunk(parsed.rows, FIRESTORE_BATCH_LIMIT)) {
      const batch = writeBatch(firestore);

      for (const row of rows) {
        batch.set(doc(assetSnapshotsRef(firestore, uid), row.date), {
          date: row.date,
          total: row.total,
          byType: row.byType,
          importedAt: serverTimestamp(),
        });
      }

      // 500件ごとの書き込みは順に確定させる(同時に投げても速くならず、失敗時の状態が読めない)
      await batch.commit();
      writtenCount += rows.length;
    }
  } catch (error) {
    console.error("資産残高を取り込めませんでした", error);
    return { ok: false, reason: toFailureReason(error), writtenCount };
  }

  try {
    // 履歴は資産残高の書き込みが終わってから残す。先に残すと、途中で失敗したときに
    // 反映されていない取込が履歴にだけ現れる
    const historyBatch = writeBatch(firestore);
    historyBatch.set(doc(csvImportsRef(firestore, uid)), {
      typeId: "asset-balance" satisfies CsvImportTypeId,
      fileName,
      rowCount: parsed.rows.length,
      periodFrom: parsed.periodFrom,
      periodTo: parsed.periodTo,
      importedAt: serverTimestamp(),
    });
    await historyBatch.commit();
  } catch (error) {
    // 資産残高そのものは全件入っている。履歴が欠けただけであることを区別して伝える
    console.error("取込履歴を残せませんでした", error);
    return { ok: false, reason: "history-write-failed", writtenCount };
  }

  return { ok: true, writtenCount };
};

/** Firestoreの`Timestamp`をISO 8601の文字列にする。サーバー時刻が未確定の間は`null` */
const toIsoString = (value: unknown): string | null =>
  value instanceof Timestamp ? value.toDate().toISOString() : null;

/** 文字列以外が入っていた場合に画面を壊さないためのフォールバック付きの読み出し */
const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const readNumber = (value: unknown): number => (typeof value === "number" ? value : 0);

/** 取込種別。現状書き込むのは資産残高推移だけなので、解釈できない値はそちらに寄せる */
const readTypeId = (value: unknown): CsvImportTypeId =>
  value === "transaction" ? "transaction" : "asset-balance";

/**
 * 直近の取込履歴を新しい順に取得する(B2の表示項目「直近の取込履歴」)。
 *
 * 書き込み直後は`importedAt`のサーバー時刻がまだ確定していないことがあるため、
 * 日時は`null`を許して呼び出し側で「取込中」相当の表示に落とす。
 */
export const fetchImportHistory = async (): Promise<
  { ok: true; entries: CsvImportHistoryEntry[] } | { ok: false; reason: CsvImportFailureReason }
> => {
  const context = resolveContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(
        csvImportsRef(context.firestore, context.uid),
        orderBy("importedAt", "desc"),
        limit(IMPORT_HISTORY_LIMIT),
      ),
    );

    const entries = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        typeId: readTypeId(data.typeId),
        fileName: readString(data.fileName, ""),
        rowCount: readNumber(data.rowCount),
        importedAt: toIsoString(data.importedAt),
        periodFrom: readString(data.periodFrom, ""),
        periodTo: readString(data.periodTo, ""),
      };
    });

    return { ok: true, entries };
  } catch (error) {
    console.error("取込履歴を取得できませんでした", error);
    return { ok: false, reason: toFailureReason(error) };
  }
};
