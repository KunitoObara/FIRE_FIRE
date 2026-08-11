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
} from "firebase/firestore";

import { FIRESTORE_BATCH_LIMIT } from "@/constants/csv-import";
import { TRANSACTION_SCAN_LIMIT } from "@/constants/transactions";
import { chunk } from "@/lib/csv-import/batch";
import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { resolveTransactionDateRange } from "@/lib/transactions/period";
import { transactionDocumentSchema } from "@/schemas/transactions";

import type { Firestore, QueryConstraint } from "firebase/firestore";

/**
 * 取引データのFirestore入出力(B2 CSV取込の入出金明細タブと、B3 収支明細一覧の読み取り)。
 *
 * ```
 * users/{uid}/transactions/{ID}   マネーフォワードの`ID`をそのままドキュメントIDにする
 * users/{uid}/csvImports/{importId}   取込履歴。資産残高推移と共通で`typeId`だけ変える
 * ```
 *
 * 読み出し(`fetchTransactions`)を書き込みと同じファイルに置くのは、資産残高推移の
 * `asset-balance-repository.ts`が取込と`fetchAssetSnapshots`を同居させているのと同じ扱い。
 * コレクションの形を知っている場所を1つにする。
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
 * B3が表示する取引を取得する(docs/transaction-import-requirements.md 8章)。
 *
 * **読むのは選択中の期間の分だけ。** 費目・口座・キーワードの絞り込みと並び替えは、読み込んだ
 * 範囲に対してクライアント側で行う(`lib/transactions/query.ts`)。Firestoreの複合条件に
 * 載せると組み合わせごとに複合インデックスが要り、キーワードの部分一致は元々表現できない。
 * 範囲は`date`の単一フィールドなので複合インデックスは要らない。
 *
 * **打ち切りは1件余分に読んで判定する。** `TRANSACTION_SCAN_LIMIT`件を超えて返ってきたら
 * 打ち切りとし、表示に使うのは先頭の`TRANSACTION_SCAN_LIMIT`件。「取得件数が上限と一致したか」
 * で判定すると、該当件数がちょうど上限と同じだった場合にも打ち切りの案内が出る。データは
 * 欠けていないので実害は小さいが、一度でも誤った案内を見ると本当に打ち切られたときの案内も
 * 信じられなくなる。取引は際限なく増えるデータなので、ちょうど一致する状況は他のコレクション
 * より起こりやすい。
 *
 * **判定は選択中の期間で分岐しない。** 実際に上限へ達しやすいのは「全期間」だが、取引が
 * 増えれば短い期間でも起こる。`periodId === 'all'`で分岐すると、その日が来たときに黙って
 * 古い側が欠ける。
 *
 * 日付の新しい順に読むので、打ち切りで落ちるのは古い側だけになる。
 *
 * 形が違うドキュメントはその1件だけを飛ばす。1件の不整合で一覧全体を空にする方が情報が減る
 * (`fetchAssetSnapshots`と同じ扱い)。
 */
export const fetchTransactions = async (
  periodId: TransactionPeriodId,
  now: Date,
): Promise<TransactionsFetchResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  const range = resolveTransactionDateRange(periodId, now);
  // 「全期間」は境界を持たない。`null`のまま`where`に渡すと日付として比較されてしまうので、
  // 条件そのものを付けない
  const rangeConstraints: QueryConstraint[] = [
    range.from === null ? null : where("date", ">=", range.from),
    range.to === null ? null : where("date", "<=", range.to),
  ].filter((constraint) => constraint !== null);

  try {
    const snapshot = await getDocs(
      query(
        transactionsRef(context.firestore, context.uid),
        ...rangeConstraints,
        orderBy("date", "desc"),
        // 1件余分に読んで「上限を超えて存在するか」を見る。`TRANSACTION_SCAN_LIMIT`が
        // `FIRESTORE_QUERY_LIMIT_MAX - 1`なのは、この`+ 1`が上限を超えないようにするため
        limit(TRANSACTION_SCAN_LIMIT + 1),
      ),
    );

    const truncated = snapshot.docs.length > TRANSACTION_SCAN_LIMIT;
    const transactions = snapshot.docs
      .slice(0, TRANSACTION_SCAN_LIMIT)
      .flatMap((document): Transaction[] => {
        const parsed = transactionDocumentSchema.safeParse(document.data());

        if (!parsed.success) {
          console.error("取引を解釈できませんでした", document.id, parsed.error.issues);
          return [];
        }

        return [
          {
            id: document.id,
            date: parsed.data.date,
            content: parsed.data.content,
            amount: parsed.data.amount,
            account: parsed.data.account,
            categoryMajor: parsed.data.categoryMajor,
            categoryMinor: parsed.data.categoryMinor,
            memo: parsed.data.memo,
            isTransfer: parsed.data.isTransfer,
            isCalculationTarget: parsed.data.isCalculationTarget,
          },
        ];
      });

    return { ok: true, transactions, truncated };
  } catch (error) {
    console.error("取引を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

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
