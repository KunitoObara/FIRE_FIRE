import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  DEBT_BALANCE_MAX,
  DEBT_BALANCE_REQUIRED_MESSAGE,
  DEBT_BALANCE_TOO_LARGE_MESSAGE,
  DEBT_DECIMAL_PATTERN,
  DEBT_INTEGER_PATTERN,
  DEBT_INTEREST_RATE_MAX,
  DEBT_INTEREST_RATE_RANGE_MESSAGE,
  DEBT_MAX_COUNT,
  DEBT_NAME_MAX_LENGTH,
  DEBT_NAME_REQUIRED_MESSAGE,
  DEBT_NAME_TOO_LONG_MESSAGE,
  DEBT_NUMBER_FORMAT_MESSAGE,
  DEBT_REPAYMENT_MONTHS_MAX,
  DEBT_REPAYMENT_MONTHS_RANGE_MESSAGE,
  DEBT_REPAYMENT_YEARS_MAX,
  DEBT_REPAYMENT_YEARS_RANGE_MESSAGE,
} from "@/constants/debts";

/**
 * B11 負債入力画面で扱う外部入力のスキーマ。
 *
 * Firestoreから読み出した生データも、B11のユーザー入力も、型が保証されない外部入力として
 * `unknown`で受け、ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/** 残債の履歴のキー(`yyyy-MM-dd`)。ドキュメントIDではないが日付の形は崩させない */
const HISTORY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * 任意入力の数値欄1つ分の検証。エラーが無ければ`null`を返す。
 *
 * 空文字は「未登録」であってエラーではない(金利・残りの返済期間は任意入力)。
 * 入力されている場合だけ形式と範囲を見る。カンマ区切りや全角数字を受け付けないのは
 * B7の金額欄と同じで、保存された数値と入力した文字列が食い違う余地を作らないため。
 */
const validateOptionalNumber = (
  value: string,
  { pattern, max, rangeMessage }: { pattern: RegExp; max: number; rangeMessage: string },
): string | null => {
  if (value.length === 0) {
    return null;
  }

  if (!pattern.test(value)) {
    return DEBT_NUMBER_FORMAT_MESSAGE;
  }

  return Number(value) > max ? rangeMessage : null;
};

/**
 * 負債1行分の入力値。
 *
 * 数値は`number`ではなく文字列で持つ。`<input type="number">`にすると指数表記(`1e5`)や
 * 全角数字がブラウザごとに異なる扱いになり、「半角数字のみ」という要件を画面側で
 * 揃えられないため、テキストとして受けてここで検証する(B7の金額欄と同じ扱い)。
 *
 * `id`は保存済みの負債を指す。画面上で追加しただけの行は`null`で、行の同一性を
 * 配列の位置では表さない(DESIGN.md 6章)。`updatedAt`は最終更新日の表示にだけ使う
 * 読み取り専用の値で、入力項目ではない。
 */
const debtRowSchema = z.object({
  id: z.string().nullable(),
  name: z.string().trim(),
  balance: z.string().trim(),
  interestRate: z.string().trim(),
  repaymentYears: z.string().trim(),
  repaymentMonths: z.string().trim(),
  updatedAt: z.string().nullable(),
});

/**
 * B11 負債入力フォーム全体の入力値。
 *
 * 1件=1フォームに見えるが、画面全体を「保存」で一括保存するため、react-hook-formの
 * フォームは1つで`useFieldArray`が行を持つ(DESIGN.md 6章)。行ごとに独立したフォーム状態を
 * 持たせると、途中まで保存された状態が残る。
 *
 * 件数の上限は`DEBT_MAX_COUNT`。上限に達したら「負債を追加」を押せなくするので、
 * ここでのエラーは通常起きないが、`firestore.rules`が同じ値で拒否する以上、
 * 保存を試みる前に画面側でも止める。
 */
export const debtFormSchema = z.object({
  debts: z
    .array(
      debtRowSchema.superRefine((row, ctx) => {
        if (row.name.length === 0) {
          ctx.addIssue({ code: "custom", message: DEBT_NAME_REQUIRED_MESSAGE, path: ["name"] });
        } else if (row.name.length > DEBT_NAME_MAX_LENGTH) {
          ctx.addIssue({ code: "custom", message: DEBT_NAME_TOO_LONG_MESSAGE, path: ["name"] });
        }

        // 残債だけは必須。0円は完済した負債を残すための正当な値なので、空文字とは分けて扱う
        if (row.balance.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: DEBT_BALANCE_REQUIRED_MESSAGE,
            path: ["balance"],
          });
        } else if (!DEBT_INTEGER_PATTERN.test(row.balance)) {
          ctx.addIssue({ code: "custom", message: DEBT_NUMBER_FORMAT_MESSAGE, path: ["balance"] });
        } else if (Number(row.balance) > DEBT_BALANCE_MAX) {
          ctx.addIssue({
            code: "custom",
            message: DEBT_BALANCE_TOO_LARGE_MESSAGE,
            path: ["balance"],
          });
        }

        const optionalFields = [
          [
            "interestRate",
            {
              pattern: DEBT_DECIMAL_PATTERN,
              max: DEBT_INTEREST_RATE_MAX,
              rangeMessage: DEBT_INTEREST_RATE_RANGE_MESSAGE,
            },
          ],
          [
            "repaymentYears",
            {
              pattern: DEBT_INTEGER_PATTERN,
              max: DEBT_REPAYMENT_YEARS_MAX,
              rangeMessage: DEBT_REPAYMENT_YEARS_RANGE_MESSAGE,
            },
          ],
          // 「ヶ月」を0〜11に縛るのは、12ヶ月以上を「年」で表すため。片方の欄だけが
          // 入力された場合はエラーにせず、空欄側を0として保存時に総月数へ正規化する
          // (docs/screen-requirements-dashboard.md B11「バリデーション」)
          [
            "repaymentMonths",
            {
              pattern: DEBT_INTEGER_PATTERN,
              max: DEBT_REPAYMENT_MONTHS_MAX,
              rangeMessage: DEBT_REPAYMENT_MONTHS_RANGE_MESSAGE,
            },
          ],
        ] as const;

        for (const [field, rule] of optionalFields) {
          const message = validateOptionalNumber(row[field], rule);

          if (message !== null) {
            ctx.addIssue({ code: "custom", message, path: [field] });
          }
        }
      }),
    )
    .max(DEBT_MAX_COUNT),
});

/**
 * 負債のドキュメント(`users/{uid}/debts/{debtId}`)。
 *
 * `createdAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する(`categoryAxisDocumentSchema`と同じ扱い)。
 * 一方`updatedAt`はB1・B11が表示する最終更新日そのものなので、`yyyy-MM-dd`の形まで検証する。
 *
 * `balanceHistory`のキーと値の形は`firestore.rules`では検査しきれないため
 * (`byType`・`assumptions.entries`と同じ制約)、ここで担保する。
 */
export const debtDocumentSchema = z.object({
  name: z.string(),
  balance: z.number(),
  interestRate: z.number().nullable(),
  repaymentMonths: z.number().nullable(),
  updatedAt: z.string().regex(HISTORY_DATE_PATTERN),
  balanceHistory: z.record(z.string().regex(HISTORY_DATE_PATTERN), z.number()),
  createdAt: z.instanceof(Timestamp).nullable(),
});
