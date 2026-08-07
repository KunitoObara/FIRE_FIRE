import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  EXPECTED_RETURN_ABS_MAX,
  EXPECTED_RETURN_FORMAT_MESSAGE,
  EXPECTED_RETURN_PATTERN,
  EXPECTED_RETURN_RANGE_MESSAGE,
  UNSET_RISK_LEVEL_VALUE,
} from "@/constants/assumptions";

/**
 * B9 想定利回り・リスク設定画面で扱う外部入力のスキーマ。
 *
 * Firestoreから読み出した生データも、B9のユーザー入力も、型が保証されない外部入力として
 * `unknown`で受け、ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/** 想定利回り1つ分の検証。エラーが無ければ`null`を返す。空欄(未設定)は呼び出し元が先に弾く */
const validateExpectedReturn = (value: string): string | null => {
  if (!EXPECTED_RETURN_PATTERN.test(value)) {
    return EXPECTED_RETURN_FORMAT_MESSAGE;
  }

  if (Math.abs(Number(value)) > EXPECTED_RETURN_ABS_MAX) {
    return EXPECTED_RETURN_RANGE_MESSAGE;
  }

  return null;
};

/**
 * B9 想定利回り・リスク設定フォームの入力値。
 *
 * 想定利回りは`number`ではなく文字列で持つ。`<input type="number">`にすると指数表記(`1e5`)や
 * 全角数字の扱いがブラウザごとに変わり、「半角数字のみ」という判定を画面側で揃えられないため
 * (B7・B8の数値欄と同じ理由)。数値への変換は保存直前に行う(`src/lib/assumptions/form-values.ts`)。
 *
 * **どの欄も必須にしない**。一覧に並ぶのは取り込んだ資産種別すべてで、その全部に想定を
 * 置けるとは限らないため(まだ決めていない資産種別を空欄のまま残せる)。ただし入力されて
 * いる以上は形式を検証し、エラーはその行にインライン表示する(要件の遷移条件)。
 */
export const assumptionsFormSchema = z.object({
  rows: z.array(
    z
      .object({
        /** 行がどの資産種別のものかを保持する。表示にも保存のキーにも使う(入力欄ではない) */
        assetTypeName: z.string(),
        expectedReturn: z.string().trim(),
        riskLevel: z.union([z.enum(["low", "medium", "high"]), z.literal(UNSET_RISK_LEVEL_VALUE)]),
      })
      .superRefine((row, ctx) => {
        if (row.expectedReturn.length === 0) {
          return;
        }

        const message = validateExpectedReturn(row.expectedReturn);

        if (message !== null) {
          ctx.addIssue({ code: "custom", message, path: ["expectedReturn"] });
        }
      }),
  ),
});

/**
 * 資産種別1つ分の想定値(`settings/assumptions`の`entries`の値)。
 *
 * 未設定の欄は`null`で保存する。キーごと省く形にしないのは、「設定していない」と
 * 「読み出しに失敗した」を読み出し側で区別できるようにするため(`FireGoal`と同じ扱い)。
 */
export const assetAssumptionSchema = z.object({
  expectedReturn: z.number().nullable(),
  riskLevel: z.enum(["low", "medium", "high"]).nullable(),
});

/**
 * 想定利回り・リスクのドキュメント(`users/{uid}/settings/assumptions`)。
 *
 * `entries`の値は`unknown`のまま受け、キーごとに`assetAssumptionSchema`へ通す
 * (`src/lib/assumptions/assumption-repository.ts`)。1件でも解釈できない資産種別が
 * あるとドキュメントごと落ちる形にすると、他の資産種別の設定まで見えなくなるため。
 *
 * `updatedAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する。
 */
export const assumptionsDocumentSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
  updatedAt: z.instanceof(Timestamp).nullable(),
});
