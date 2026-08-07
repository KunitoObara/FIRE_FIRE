import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import { CATEGORY_AXIS_NAME_MAX_LENGTH } from "@/constants/asset-categories";

/**
 * B4 資産分類マスタで扱う外部入力のスキーマ。
 *
 * Firestoreから読み出した生データは型が保証されない外部入力として`unknown`で受け、
 * ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/**
 * 追加・編集フォームの入力値。
 *
 * B4はDESIGN.md 6章のインラインバリデーション必須画面(A1・A7・B7・B8・B9)に含まれないため
 * react-hook-formは使わないが、外部入力(ユーザーの手入力)であることに変わりはないので
 * 送信直前にこのスキーマで確かめる。
 */
export const categoryAxisFormSchema = z.object({
  name: z.string().trim().min(1).max(CATEGORY_AXIS_NAME_MAX_LENGTH),
  assetTypeNames: z.array(z.string()),
});

/**
 * 分類軸のドキュメント(`users/{uid}/categoryAxes/{axisId}`)。
 *
 * `createdAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する(csvImportHistoryDocumentSchemaと同じ扱い)。
 */
export const categoryAxisDocumentSchema = z.object({
  name: z.string(),
  assetTypeNames: z.array(z.string()),
  createdAt: z.instanceof(Timestamp).nullable(),
});

/**
 * 資産残高スナップショット(`users/{uid}/assetSnapshots/{date}`)のうち、
 * 集計対象の選択肢を作るのに必要な`byType`のキーだけを取り出すためのスキーマ。
 */
export const assetSnapshotAssetTypesSchema = z.object({
  byType: z.record(z.string(), z.unknown()),
});
