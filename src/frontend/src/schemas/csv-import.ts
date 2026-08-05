import { Timestamp } from "firebase/firestore";
import { z } from "zod";

/**
 * B2 CSV取込で扱う外部入力のスキーマ。
 *
 * CSVのパース結果もFirestoreから読み出した生データも、型が保証されない外部入力として
 * `unknown`で受けてからここで形を確定させる(CODING_STANDARDS.md 1章)。
 */

/**
 * papaparseが返す表。ヘッダーを使わず配列のまま受けるため、文字列の二次元配列になる。
 *
 * 型引数で`string[]`と宣言しても実行時には何も保証されないので、パーサの入り口で1度だけ
 * 形を確かめる。ここを通った後は、セルが文字列であることを前提にしてよい。
 */
export const csvTableSchema = z.array(z.array(z.string()));

/**
 * 資産残高のドキュメント(`users/{uid}/assetSnapshots/{date}`)。
 *
 * `byType`のキーは資産種別名で、保有状況によって増減するため列挙できない。
 * `firestore.rules`もマップであることしか検査できていない(繰り返しが書けないため)ので、
 * 金額が数値かどうかは値を1件ずつ読む側で確かめる。ここでは`unknown`のまま受ける。
 */
export const assetSnapshotDocumentSchema = z.object({
  date: z.string(),
  total: z.number(),
  byType: z.record(z.string(), z.unknown()),
});

/**
 * 取込履歴のドキュメント(`users/{uid}/csvImports/{importId}`)。
 *
 * 書き込むのはこのアプリ自身だが、`firestore.rules`が受け付ける形と読み出し側の期待が
 * ずれたまま気づかない状態を避けるため、読み出しでも検証する。
 *
 * `importedAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する。
 */
export const csvImportHistoryDocumentSchema = z.object({
  typeId: z.enum(["asset-balance", "transaction"]),
  fileName: z.string(),
  rowCount: z.number().int().nonnegative(),
  periodFrom: z.string(),
  periodTo: z.string(),
  importedAt: z.instanceof(Timestamp).nullable(),
});
