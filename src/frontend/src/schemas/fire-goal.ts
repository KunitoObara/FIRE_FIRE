import { Timestamp } from "firebase/firestore";
import { z } from "zod";

import {
  buildFireGoalRequiredMessage,
  FIRE_GOAL_AMOUNT_FORMAT_MESSAGE,
  FIRE_GOAL_AMOUNT_MAX,
  FIRE_GOAL_AMOUNT_PATTERN,
  FIRE_GOAL_AMOUNT_TOO_LARGE_MESSAGE,
  FIRE_GOAL_AMOUNT_TOO_SMALL_MESSAGE,
  FIRE_GOAL_ANNUAL_EXPENSE_LABEL,
  FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE,
  FIRE_GOAL_MONTHLY_CONTRIBUTION_LABEL,
  FIRE_GOAL_MONTHLY_CONTRIBUTION_PATTERN,
  FIRE_GOAL_MONTHLY_CONTRIBUTION_TOO_LARGE_MESSAGE,
  FIRE_GOAL_TARGET_AMOUNT_LABEL,
  FIRE_GOAL_WITHDRAWAL_RATE_FORMAT_MESSAGE,
  FIRE_GOAL_WITHDRAWAL_RATE_LABEL,
  FIRE_GOAL_WITHDRAWAL_RATE_MAX,
  FIRE_GOAL_WITHDRAWAL_RATE_PATTERN,
  FIRE_GOAL_WITHDRAWAL_RATE_RANGE_MESSAGE,
} from "@/constants/fire-goal";

/**
 * B8 FIRE目標設定画面で扱う外部入力のスキーマ。
 *
 * Firestoreから読み出した生データも、B8のユーザー入力も、型が保証されない外部入力として
 * `unknown`で受け、ここでパースしてから使う(CODING_STANDARDS.md 1章)。
 */

/**
 * 金額欄1つ分の検証。エラーが無ければ`null`を返す。
 *
 * 空文字は「未入力」としてここでは通す。必須かどうかは有効な設定方式によって変わるため、
 * 呼び出し元(`superRefine`)が判断する。
 */
const validateAmount = (value: string): string | null => {
  if (!FIRE_GOAL_AMOUNT_PATTERN.test(value)) {
    return FIRE_GOAL_AMOUNT_FORMAT_MESSAGE;
  }

  if (Number(value) === 0) {
    return FIRE_GOAL_AMOUNT_TOO_SMALL_MESSAGE;
  }

  if (Number(value) > FIRE_GOAL_AMOUNT_MAX) {
    return FIRE_GOAL_AMOUNT_TOO_LARGE_MESSAGE;
  }

  return null;
};

/**
 * 毎月の積立額の検証。空文字(未入力)はここに来ない(呼び出し元が先に通す)。
 *
 * 0を弾かないのが他の金額欄との違い。「積立なし」は正当な設定で、未入力もそれと同じ扱いに
 * なる(要件B8)。上限は符号を除いた桁数で見る。
 */
const validateMonthlyContribution = (value: string): string | null => {
  if (!FIRE_GOAL_MONTHLY_CONTRIBUTION_PATTERN.test(value)) {
    return FIRE_GOAL_MONTHLY_CONTRIBUTION_FORMAT_MESSAGE;
  }

  if (Math.abs(Number(value)) > FIRE_GOAL_AMOUNT_MAX) {
    return FIRE_GOAL_MONTHLY_CONTRIBUTION_TOO_LARGE_MESSAGE;
  }

  return null;
};

/** 逆算係数の検証。0%は「年間支出額 ÷ 0」になり目標額を導けないため通さない */
const validateWithdrawalRate = (value: string): string | null => {
  if (!FIRE_GOAL_WITHDRAWAL_RATE_PATTERN.test(value)) {
    return FIRE_GOAL_WITHDRAWAL_RATE_FORMAT_MESSAGE;
  }

  const rate = Number(value);

  if (rate <= 0 || rate > FIRE_GOAL_WITHDRAWAL_RATE_MAX) {
    return FIRE_GOAL_WITHDRAWAL_RATE_RANGE_MESSAGE;
  }

  return null;
};

/**
 * B8 FIRE目標設定フォームの入力値。
 *
 * 金額・係数は`number`ではなく文字列で持つ。`<input type="number">`にすると指数表記(`1e5`)や
 * 全角数字の扱いがブラウザごとに変わり、「半角数字のみ」という判定を画面側で揃えられないため
 * (B7の金額欄と同じ理由)。数値への変換は保存直前に行う(`src/lib/fire-goal/form-values.ts`)。
 *
 * `mode`はタブの選択状態そのものであり、同時に保存される「現在有効な設定方式」でもある。
 * タブとフォームで別々に選択状態を持つと、表示中のタブと保存される方式がずれうるため1つにする。
 *
 * **必須になるのは有効な方式の欄だけ**。直接入力しか使わないユーザーに年間支出額の入力まで
 * 求めないため。ただし入力されている以上は非表示タブの欄も形式を検証する。書き間違いを
 * 黙って捨てて保存すると、次に方式を切り替えたときに入力が消えたように見えるため。
 */
export const fireGoalFormSchema = z
  .object({
    mode: z.enum(["direct", "reverse"]),
    targetAmount: z.string().trim(),
    annualExpense: z.string().trim(),
    withdrawalRate: z.string().trim(),
    /**
     * 毎月の積立額。タブの外にある共通の設定なので、どちらの方式でも同じ欄を検証する。
     * 未入力は0(積立なし)として扱うため必須にしない(要件B8)。
     */
    monthlyContribution: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const fields = [
      {
        name: "targetAmount",
        label: FIRE_GOAL_TARGET_AMOUNT_LABEL,
        required: values.mode === "direct",
        validate: validateAmount,
      },
      {
        name: "annualExpense",
        label: FIRE_GOAL_ANNUAL_EXPENSE_LABEL,
        required: values.mode === "reverse",
        validate: validateAmount,
      },
      {
        name: "withdrawalRate",
        label: FIRE_GOAL_WITHDRAWAL_RATE_LABEL,
        required: values.mode === "reverse",
        validate: validateWithdrawalRate,
      },
      {
        name: "monthlyContribution",
        label: FIRE_GOAL_MONTHLY_CONTRIBUTION_LABEL,
        // 未入力は0(積立なし)。方式によらず必須にしない
        required: false,
        validate: validateMonthlyContribution,
      },
    ] as const;

    for (const field of fields) {
      const value = values[field.name];

      if (value.length === 0) {
        if (field.required) {
          ctx.addIssue({
            code: "custom",
            message: buildFireGoalRequiredMessage(field.label),
            path: [field.name],
          });
        }

        continue;
      }

      const message = field.validate(value);

      if (message !== null) {
        ctx.addIssue({ code: "custom", message, path: [field.name] });
      }
    }
  });

/**
 * FIRE目標のドキュメント(`users/{uid}/settings/fireGoal`)。
 *
 * 未入力の欄は`null`で保存する。キーごと省く形にしないのは、「入力されていない」と
 * 「読み出しに失敗した」を読み出し側で区別できるようにするため(物件の`rental`と同じ扱い)。
 *
 * `updatedAt`は`serverTimestamp()`で書いており、サーバー時刻が確定するまでの短い間は
 * `null`で返る。欠損ではないので許容する。
 */
export const fireGoalDocumentSchema = z.object({
  mode: z.enum(["direct", "reverse"]),
  targetAmount: z.number().nullable(),
  annualExpense: z.number().nullable(),
  withdrawalRate: z.number().nullable(),
  /**
   * 達成度の対象分類(B4の分類軸ID)。既定の「総資産」は`null`。
   *
   * **キーそのものが無い場合も通す。** 対象分類を持たない状態で保存された既存の目標が
   * あり、必須にするとそれらが「解釈できないドキュメント」として未設定に倒れ、
   * 設定済みの目標額まで消えたように見えるため(要件B1「既存ユーザーはこれまでどおりの
   * 値のままになる」)。読み出し側が`null`(=既定)として扱う。
   */
  achievementAxisId: z.string().nullable().optional(),
  /**
   * 毎月の積立額(円)。未入力は`null`で、到達予測では0(積立なし)として扱う。
   *
   * **キーそのものが無い場合も通す。** 積立額を持たずに保存された既存の目標があり、
   * 必須にするとそれらが「解釈できないドキュメント」として未設定に倒れ、設定済みの
   * 目標額まで消えたように見えるため(`achievementAxisId`と同じ理由)。
   */
  monthlyContribution: z.number().nullable().optional(),
  updatedAt: z.instanceof(Timestamp).nullable(),
});
