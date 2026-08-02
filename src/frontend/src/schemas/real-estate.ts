import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  buildRealEstateAmountRequiredMessage,
  REAL_ESTATE_AMOUNT_FORMAT_MESSAGE,
  REAL_ESTATE_AMOUNT_MAX,
  REAL_ESTATE_AMOUNT_PATTERN,
  REAL_ESTATE_AMOUNT_TOO_LARGE_MESSAGE,
  REAL_ESTATE_FORM_LOAN_BALANCE_LABEL,
  REAL_ESTATE_FORM_MARKET_VALUE_LABEL,
  REAL_ESTATE_FORM_RENTAL_EXPENSE_LABEL,
  REAL_ESTATE_FORM_RENTAL_INCOME_LABEL,
  REAL_ESTATE_LOCATION_MAX_LENGTH,
  REAL_ESTATE_LOCATION_TOO_LONG_MESSAGE,
  REAL_ESTATE_NAME_MAX_LENGTH,
  REAL_ESTATE_NAME_REQUIRED_MESSAGE,
  REAL_ESTATE_NAME_TOO_LONG_MESSAGE,
} from "@/constants/real-estate";

/**
 * B5〜B7 不動産管理系画面で扱う外部入力のスキーマ。
 *
 * Firestoreから読み出した生データも、B7のユーザー入力も、型が保証されない外部入力として
 * `unknown`で受け、ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/**
 * 金額欄1つ分の検証。エラーが無ければ`null`を返す。
 *
 * 4つの金額欄(時価・ローン残高・賃貸収入・賃貸支出)で同じ規則を使うため関数にしている。
 * 賃貸の2欄は「収益物件として登録」がオンのときだけ必須になり、フィールド単体のスキーマでは
 * 表せないので、`superRefine`から呼ぶ形にした。
 *
 * カンマ区切り(`18,400,000`)や全角数字は受け付けずエラーにする。入力形式を1つに絞り、
 * 保存された金額と入力した文字列が食い違う余地を作らないため
 * (HTMLモック b7-real-estate-edit.html のエラー表示と対応)。
 */
const validateAmount = (value: string, label: string): string | null => {
  if (value.length === 0) {
    return buildRealEstateAmountRequiredMessage(label);
  }

  if (!REAL_ESTATE_AMOUNT_PATTERN.test(value)) {
    return REAL_ESTATE_AMOUNT_FORMAT_MESSAGE;
  }

  if (Number(value) > REAL_ESTATE_AMOUNT_MAX) {
    return REAL_ESTATE_AMOUNT_TOO_LARGE_MESSAGE;
  }

  return null;
};

/**
 * B7 不動産登録・編集フォームの入力値。
 *
 * 金額は`number`ではなく文字列で持つ。`<input type="number">`にすると指数表記(`1e5`)や
 * 全角数字がブラウザごとに異なる扱いになり、「半角数字のみ」という要件を画面側で
 * 揃えられないため、テキストとして受けてここで検証する。数値への変換は保存直前に行う
 * (`src/lib/real-estate/form-values.ts`)。
 *
 * 所在地は任意入力(未入力可)。B5の一覧には空欄として並ぶ。
 */
export const realEstateFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, REAL_ESTATE_NAME_REQUIRED_MESSAGE)
      .max(REAL_ESTATE_NAME_MAX_LENGTH, REAL_ESTATE_NAME_TOO_LONG_MESSAGE),
    location: z
      .string()
      .trim()
      .max(REAL_ESTATE_LOCATION_MAX_LENGTH, REAL_ESTATE_LOCATION_TOO_LONG_MESSAGE),
    marketValue: z.string().trim(),
    loanBalance: z.string().trim(),
    isRentalProperty: z.boolean(),
    rentalMonthlyIncome: z.string().trim(),
    rentalMonthlyExpense: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    // 収益物件でない場合、賃貸の2欄は検証しない。書きかけの値が残っていても保存はされず
    // (`toRealEstatePropertyInput`が捨てる)、チェックを戻せばそのまま使えるようにする
    const amounts = values.isRentalProperty
      ? ([
          ["marketValue", REAL_ESTATE_FORM_MARKET_VALUE_LABEL],
          ["loanBalance", REAL_ESTATE_FORM_LOAN_BALANCE_LABEL],
          ["rentalMonthlyIncome", REAL_ESTATE_FORM_RENTAL_INCOME_LABEL],
          ["rentalMonthlyExpense", REAL_ESTATE_FORM_RENTAL_EXPENSE_LABEL],
        ] as const)
      : ([
          ["marketValue", REAL_ESTATE_FORM_MARKET_VALUE_LABEL],
          ["loanBalance", REAL_ESTATE_FORM_LOAN_BALANCE_LABEL],
        ] as const);

    for (const [field, label] of amounts) {
      const message = validateAmount(values[field], label);

      if (message !== null) {
        ctx.addIssue({ code: "custom", message, path: [field] });
      }
    }
  });

/**
 * 物件のドキュメント(`users/{uid}/properties/{propertyId}`)。
 *
 * `rental`は収益物件でない場合`null`で保存する。キーごと省く形にしないのは、
 * 「登録されていない」と「読み出しに失敗した」を読み出し側で区別できるようにするため。
 *
 * `createdAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する(`categoryAxisDocumentSchema`と同じ扱い)。
 * 一方`updatedAt`はB6が表示する最終更新日そのものなので、`yyyy-MM-dd`の形まで検証する。
 */
export const realEstatePropertyDocumentSchema = z.object({
  name: z.string(),
  location: z.string(),
  marketValue: z.number(),
  loanBalance: z.number(),
  rental: z
    .object({
      monthlyIncome: z.number(),
      monthlyExpense: z.number(),
    })
    .nullable(),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  createdAt: z.instanceof(Timestamp).nullable(),
});
