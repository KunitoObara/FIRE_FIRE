import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { FIRESTORE_BATCH_LIMIT } from "@/constants/csv-import";
import { chunk } from "@/lib/csv-import/batch";
import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";

import type { Firestore } from "firebase/firestore";

/**
 * 取引データのFirestore入出力(B2 CSV取込の入出金明細タブ)。
 *
 * ```
 * users/{uid}/transactions/{ID}   マネーフォワードの`ID`をそのままドキュメントIDにする
 * users/{uid}/csvImports/{importId}   取込履歴。資産残高推移と共通で`typeId`だけ変える
 * ```
 *
 * 資産残高推移(`asset-balance-repository.ts`)と同じ形にしてあるが、冪等性の取り方だけが
 * 違う。あちらは「同じ日付を上書きする」、こちらは**「同じ`ID`を上書きする」**ことで
 * 同じCSVを何度取り込んでも結果が変わらないようにする
 * (docs/transaction-import-requirements.md 4章)。
 *
 * 書き込みをクライアントSDKから直接行い、他人のデータに触れないことを`firestore.rules`で
 * 担保するのは資産残高推移と同じ(CODING_STANDARDS.md 2章)。
 */

const TRANSACTIONS_COLLECTION = "transactions";
const CSV_IMPORTS_COLLECTION = "csvImports";
const USERS_COLLECTION = "users";

/** 取引のコレクション参照 */
const transactionsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, TRANSACTIONS_COLLECTION);

/** 取込履歴のコレクション参照(資産残高推移と同じコレクション) */
const csvImportsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, CSV_IMPORTS_COLLECTION);

/**
 * 取り込もうとしている取引のうち、既にFirestoreにあるものを数える
 * (docs/transaction-import-requirements.md 7章のプレビュー「新規/上書きの内訳」)。
 *
 * CSVの期間に絞って引く。取引は際限なく増えるデータなので、全件を読むと蓄積に比例して
 * 読み取りが増えていく。期間で絞れば読むのは取込対象の期間に重なる分だけで済む
 * (`buildImportPlan`と同じ考え方)。
 *
 * ドキュメントIDがマネーフォワードの`ID`そのものなので、突き合わせはIDの一致で行う。
 * 同じ取引が期間内に別IDで入っていることはない(4章)。
 */
export const buildTransactionImportPlan = async (
  parsed: TransactionCsvParsed,
): Promise<
  { ok: true; plan: TransactionImportPlan } | { ok: false; reason: CsvImportFailureReason }
> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(
        transactionsRef(context.firestore, context.uid),
        where("date", ">=", parsed.periodFrom),
        where("date", "<=", parsed.periodTo),
      ),
    );
    const existingIds = new Set(snapshot.docs.map((document) => document.id));
    const updatedCount = parsed.rows.filter((row) => existingIds.has(row.id)).length;

    return {
      ok: true,
      plan: { newCount: parsed.rows.length - updatedCount, updatedCount },
    };
  } catch (error) {
    console.error("既存の取引を照会できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * パース済みの取引をFirestoreへ反映し、取込履歴を1件残す。
 *
 * **ドキュメントIDはCSVの`ID`列そのもので、`merge`せず丸ごと置き換える。** マネーフォワード側で
 * 費目を直してからエクスポートし直した場合に、新しい値で置き換わるようにするため(4章)。
 * 同じCSVを2回取り込んでも同じIDを上書きするだけなので、件数は増えない。
 *
 * `TransactionCsvRow`の`id`はドキュメントIDであってフィールドではないので、書き込む中身には
 * 含めない。混ぜると`firestore.rules`の`hasOnly`が拒否する。
 *
 * `writeBatch`は1回に500件までなので、それを超える取込は複数回に分けて確定する。
 * Firestoreには複数バッチをまたぐトランザクションが無く、途中で失敗するとそれまでの
 * バッチは確定したまま残る。呼び出し側が「全部失敗した」と誤って伝えないよう、
 * 失敗時も反映済みの件数を返す。同じ`ID`は上書きなので、取り込み直せば必ず揃う。
 */
export const importTransactions = async (
  parsed: TransactionCsvParsed,
  fileName: string,
): Promise<TransactionImportResult> => {
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
        batch.set(doc(transactionsRef(firestore, uid), row.id), {
          date: row.date,
          content: row.content,
          amount: row.amount,
          account: row.account,
          categoryMajor: row.categoryMajor,
          categoryMinor: row.categoryMinor,
          memo: row.memo,
          // 振替・計算対象外の行も**保存する**。集計から外すのは読み出し側で、
          // 取り込まないとB3の一覧に出ない取引が生まれる(5章)
          isTransfer: row.isTransfer,
          isCalculationTarget: row.isCalculationTarget,
          importedAt: serverTimestamp(),
        });
      }

      // 500件ごとの書き込みは順に確定させる(同時に投げても速くならず、失敗時の状態が読めない)
      await batch.commit();
      writtenCount += rows.length;
    }
  } catch (error) {
    console.error("取引を取り込めませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error), writtenCount };
  }

  try {
    // 履歴は取引の書き込みが終わってから残す。先に残すと、途中で失敗したときに
    // 反映されていない取込が履歴にだけ現れる
    const historyBatch = writeBatch(firestore);
    historyBatch.set(doc(csvImportsRef(firestore, uid)), {
      typeId: "transaction" satisfies CsvImportTypeId,
      fileName,
      rowCount: parsed.rows.length,
      periodFrom: parsed.periodFrom,
      periodTo: parsed.periodTo,
      importedAt: serverTimestamp(),
    });
    await historyBatch.commit();
  } catch (error) {
    // 取引そのものは全件入っている。履歴が欠けただけであることを区別して伝える
    console.error("取込履歴を残せませんでした", error);
    return { ok: false, reason: "history-write-failed", writtenCount };
  }

  return { ok: true, writtenCount };
};
