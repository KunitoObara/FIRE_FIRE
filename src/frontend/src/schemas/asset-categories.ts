import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  CATEGORY_AXIS_NAME_MAX_LENGTH,
  CATEGORY_AXIS_PROPERTY_MAX_COUNT,
} from "@/constants/asset-categories";
import { DEBT_MAX_COUNT } from "@/constants/debts";

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
  debtIds: z.array(z.string()).max(DEBT_MAX_COUNT),
  /**
   * 集計に加える物件と反映方法(B4「集計対象に不動産を含める」)。
   *
   * 件数の上限は**1つの軸で選べる数**で、物件の登録件数そのものは縛らない。
   * `firestore.rules`が同じ値で拒否するので、保存を試みる前に画面側でも止める
   * (`debtIds`と同じ扱い)。
   */
  propertyValuations: z
    .record(z.string(), z.enum(["spread", "marketValue"]))
    .refine((valuations) => Object.keys(valuations).length <= CATEGORY_AXIS_PROPERTY_MAX_COUNT),
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
  /**
   * 集計から差し引く負債のID(B11)。B11より前に登録された分類軸はこのフィールドを持たないため、
   * 欠損を空配列に倒す。空配列は「負債を差し引かない」を意味するので(B4)、
   * 既存の分類軸の集計は負債の登録前と変わらない。
   */
  debtIds: z.array(z.string()).default([]),
  /**
   * 集計に加える物件と反映方法(B4)。**B4-8より前に登録された分類軸はこのフィールドを
   * 持たない**ため、欠損を空のマップに倒す(`debtIds`の`.default([])`と同じ理由)。
   * 空は「不動産を反映しない」を意味するので、既存の分類軸の集計は物件の登録前と変わらない。
   *
   * 値が`spread` / `marketValue`のどちらかであることはここで見る。`firestore.rules`は
   * マップの値を1件ずつ検査できないため(要件定義書 8.1)、形の担保はこちらに置く。
   */
  propertyValuations: z.record(z.string(), z.enum(["spread", "marketValue"])).default({}),
  createdAt: z.instanceof(Timestamp).nullable(),
});

/**
 * 資産残高スナップショット(`users/{uid}/assetSnapshots/{date}`)のうち、
 * 集計対象の選択肢を作るのに必要な`byType`のキーだけを取り出すためのスキーマ。
 */
export const assetSnapshotAssetTypesSchema = z.object({
  byType: z.record(z.string(), z.unknown()),
});
