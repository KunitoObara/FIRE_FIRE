import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  TRANSACTION_ACCOUNT_MAX_LENGTH,
  TRANSACTION_CATEGORY_MAX_LENGTH,
  TRANSACTION_CONTENT_MAX_LENGTH,
  TRANSACTION_MEMO_MAX_LENGTH,
} from "@/constants/transactions-import";

/**
 * 取引データで扱う外部入力のスキーマ(docs/transaction-import-requirements.md 3.1)。
 *
 * Firestoreから読み出した生データは型が保証されない外部入力として`unknown`で受け、
 * ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/** 取引日(`yyyy-MM-dd`)。B3の期間絞り込みが範囲クエリを掛ける値なので形を崩させない */
const STORED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * 取引のドキュメント(`users/{uid}/transactions/{transactionId}`)。
 *
 * 書き込むのはこのアプリ自身だが、`firestore.rules`が受け付ける形と読み出し側の期待が
 * ずれたまま気づかない状態を避けるため、読み出しでも検証する(`debtDocumentSchema`と同じ扱い)。
 *
 * 文字数の上限もここで見る。ルール側と同じ値で二重に持つのは、片方だけが緩んだときに
 * 気づけるようにするため(3.1が両方に置くことを求めている)。
 *
 * `importedAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する。
 */
export const transactionDocumentSchema = z.object({
  date: z.string().regex(STORED_DATE_PATTERN),
  content: z.string().max(TRANSACTION_CONTENT_MAX_LENGTH),
  amount: z.number(),
  account: z.string().max(TRANSACTION_ACCOUNT_MAX_LENGTH),
  categoryMajor: z.string().max(TRANSACTION_CATEGORY_MAX_LENGTH),
  categoryMinor: z.string().max(TRANSACTION_CATEGORY_MAX_LENGTH),
  memo: z.string().max(TRANSACTION_MEMO_MAX_LENGTH),
  isTransfer: z.boolean(),
  isCalculationTarget: z.boolean(),
  importedAt: z.instanceof(Timestamp).nullable(),
});
