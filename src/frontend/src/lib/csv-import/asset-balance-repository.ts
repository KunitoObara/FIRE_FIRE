import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  ASSET_SNAPSHOT_SCAN_LIMIT,
  FIRESTORE_BATCH_LIMIT,
  IMPORT_HISTORY_LIMIT,
} from "@/constants/csv-import";
import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { assetSnapshotDocumentSchema, csvImportHistoryDocumentSchema } from "@/schemas/csv-import";

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
  const context = resolveFirestoreUserContext();

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
    return { ok: false, reason: toFirestoreFailureReason(error) };
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
  const context = resolveFirestoreUserContext();

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
    return { ok: false, reason: toFirestoreFailureReason(error), writtenCount };
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

/**
 * 直近の資産残高の総額を取得する(B8の参考表示「現在資産額」)。
 *
 * B2が取り込んだ資産残高のうち、集計日がいちばん新しい1件の`total`をそのまま返す。
 * 読み出すのはB8だが、`assetSnapshots`を扱うのはこのファイルなのでここに置く。
 *
 * CSVを一度も取り込んでいないアカウントでは1件も無いため、失敗ではなく`total: null`を返す。
 * 参考表示であって目標の設定を妨げるものではなく、呼び出し側で「未取込」として扱えるように
 * するため。`total`だけを見るので履歴のようなzodスキーマは通さず、型だけを確かめる。
 */
export const fetchLatestAssetTotal = async (): Promise<CurrentAssetTotalResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(assetSnapshotsRef(context.firestore, context.uid), orderBy("date", "desc"), limit(1)),
    );
    const latest = snapshot.docs[0];

    if (latest === undefined) {
      return { ok: true, total: null };
    }

    const total: unknown = latest.get("total");

    if (typeof total !== "number") {
      console.error("資産残高の総額を解釈できませんでした", latest.id);
      return { ok: true, total: null };
    }

    return { ok: true, total };
  } catch (error) {
    console.error("資産残高の総額を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 直近の資産残高を資産種別ごとに取得する(B9の表示項目「資産・口座一覧(名称、現在残高)」)。
 *
 * 集計日がいちばん新しい1件の`byType`をそのまま資産種別と残高の組にする。B9が設定対象と
 * するのは要件定義書4.7の「資産クラス」で、アプリが持つ資産の粒度はCSVの資産種別列しか
 * 無いため(口座単位のデータはマネーフォワードのCSVに含まれない)。
 *
 * 残高の多い順に並べる。金額の大きい資産種別ほど想定利回りが予測に効くため、先に目に
 * 入る位置へ置く。`byType`はマップでキーの順序に意味が無く、そのままでは並びが定まらない。
 *
 * CSVを一度も取り込んでいないアカウントでは1件も無いため、失敗ではなく空配列を返す。
 * 数値として読めない金額はその資産種別だけを飛ばす(残高が読めない行を出しても設定の
 * 判断材料にならず、1件の不整合で一覧全体を空にする方が情報が減るため)。
 */
export const fetchLatestAssetBalances = async (): Promise<LatestAssetBalancesResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(assetSnapshotsRef(context.firestore, context.uid), orderBy("date", "desc"), limit(1)),
    );
    const latest = snapshot.docs[0];

    if (latest === undefined) {
      return { ok: true, balances: [] };
    }

    const byType: unknown = latest.get("byType");

    if (typeof byType !== "object" || byType === null) {
      console.error("資産種別ごとの残高を解釈できませんでした", latest.id);
      return { ok: true, balances: [] };
    }

    const balances = Object.entries(byType).flatMap(([assetTypeName, balance]) => {
      if (typeof balance !== "number") {
        console.error("資産種別の残高を解釈できませんでした", latest.id, assetTypeName);
        return [];
      }

      return [{ assetTypeName, balance }];
    });

    balances.sort((left, right) => right.balance - left.balance);

    return { ok: true, balances };
  } catch (error) {
    console.error("資産種別ごとの残高を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 資産残高を日付の昇順で取得する(B1の資産推移グラフ・分類別内訳)。
 *
 * 分類軸ごとの集計は`byType`を資産種別で足し合わせて行うため、期間や分類軸で絞らず
 * 蓄積分をまとめて読み、集計と期間の絞り込みは呼び出し側(`src/lib/dashboard`)で行う。
 * 分類軸を切り替えるたびに読み直さずに済み、Firestoreの読み取り回数も1回で済む。
 *
 * 読む件数は`ASSET_SNAPSHOT_SCAN_LIMIT`で打ち切る。新しい日付から順に読むので、
 * 上限に達した場合に欠けるのは古い側(「全期間」の左端)だけになる。
 *
 * 数値として読めない金額はその資産種別だけを飛ばす。1件の不整合で推移全体を空にする方が
 * 情報が減るため(`fetchLatestAssetBalances`と同じ扱い)。
 */
export const fetchAssetSnapshots = async (): Promise<AssetSnapshotsResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(
        assetSnapshotsRef(context.firestore, context.uid),
        orderBy("date", "desc"),
        limit(ASSET_SNAPSHOT_SCAN_LIMIT),
      ),
    );

    const snapshots = snapshot.docs.flatMap((document) => {
      const parsed = assetSnapshotDocumentSchema.safeParse(document.data());

      if (!parsed.success) {
        console.error("資産残高を解釈できませんでした", document.id, parsed.error.issues);
        return [];
      }

      const byType = Object.entries(parsed.data.byType).flatMap(([assetTypeName, amount]) => {
        if (typeof amount !== "number") {
          console.error("資産種別の残高を解釈できませんでした", document.id, assetTypeName);
          return [];
        }

        return [[assetTypeName, amount] as const];
      });

      return [
        { date: parsed.data.date, total: parsed.data.total, byType: Object.fromEntries(byType) },
      ];
    });

    // 取得は新しい順(上限を新しい側から数えるため)だが、推移は古い順に描くので並べ直す
    snapshots.reverse();

    return { ok: true, snapshots };
  } catch (error) {
    console.error("資産残高を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 直近CSV取込日時を取得する(B1の表示項目「直近CSV取込日時」)。
 *
 * B2の履歴一覧(`fetchImportHistory`)と同じコレクションだが、B1が要るのは最新の1件の
 * 日時だけなので、表示件数分を読まずに`limit(1)`で引く。
 *
 * 書き込み直後は`importedAt`のサーバー時刻がまだ確定していないことがあるため、
 * 日時が読めない場合は未取込と同じ`null`に倒す。次の取得では確定した値が返る。
 */
export const fetchLastImportedAt = async (): Promise<LastImportedAtResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(csvImportsRef(context.firestore, context.uid), orderBy("importedAt", "desc"), limit(1)),
    );
    const latest = snapshot.docs[0];

    if (latest === undefined) {
      return { ok: true, lastImportedAt: null };
    }

    const importedAt: unknown = latest.get("importedAt");

    return {
      ok: true,
      lastImportedAt: importedAt instanceof Timestamp ? importedAt.toDate().toISOString() : null,
    };
  } catch (error) {
    console.error("直近CSV取込日時を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 直近の取込履歴を新しい順に取得する(B2の表示項目「直近の取込履歴」)。
 *
 * Firestoreの生データは型が保証されない外部入力なので、zodスキーマを通してから画面へ渡す
 * (CODING_STANDARDS.md 1章)。解釈できないドキュメントは履歴ごと落とさず、その1件だけを
 * 飛ばす。履歴が読めないこと自体は取込の妨げにならず、1件の不整合で画面を空にする方が
 * 情報が減るため。
 *
 * 書き込み直後は`importedAt`のサーバー時刻がまだ確定していないことがあるため、
 * 日時は`null`を許して呼び出し側で「取込中」相当の表示に落とす。
 */
export const fetchImportHistory = async (): Promise<
  { ok: true; entries: CsvImportHistoryEntry[] } | { ok: false; reason: CsvImportFailureReason }
> => {
  const context = resolveFirestoreUserContext();

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

    const entries = snapshot.docs.flatMap((document) => {
      const parsed = csvImportHistoryDocumentSchema.safeParse(document.data());

      if (!parsed.success) {
        console.error("取込履歴を解釈できませんでした", document.id, parsed.error.issues);
        return [];
      }

      const { importedAt, ...rest } = parsed.data;

      return [{ id: document.id, ...rest, importedAt: importedAt?.toDate().toISOString() ?? null }];
    });

    return { ok: true, entries };
  } catch (error) {
    console.error("取込履歴を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
