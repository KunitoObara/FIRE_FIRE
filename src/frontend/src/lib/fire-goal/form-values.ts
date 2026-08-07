import { DEFAULT_FIRE_GOAL_MODE, DEFAULT_WITHDRAWAL_RATE } from "@/constants/fire-goal";

/**
 * B8 FIRE目標設定フォームの入力値と、保存するFIRE目標の相互変換。
 *
 * フォームは金額・係数を文字列で持ち(`src/schemas/fire-goal.ts`)、Firestoreには数値で保存する。
 * 変換をここに閉じ込め、画面とリポジトリのどちらにも「文字列と数値のどちらで扱うか」の
 * 判断を持たせない(B7の`form-values.ts`と同じ役割)。
 */

/**
 * 入力欄1つ分を保存する数値に変換する。未入力は`null`にする。
 *
 * 解釈できない文字列も`null`に倒す。`Number("")`が`0`、`Number("abc")`が`NaN`になるため、
 * そのまま通すと「0円の目標」や`NaN`がFirestoreへ書き込まれてしまう。バリデーション済みの
 * 値にしか使わないので通常は起こらないが、金額を扱う変換で暗黙の`0`を作らない。
 */
const toOptionalNumber = (value: string): number | null => {
  if (value.length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * 入力値を保存する形に変換する。**バリデーション通過後の値にのみ使う**
 * (形式は`fireGoalFormSchema`が保証している)。
 *
 * 有効な方式の欄だけでなく、非表示タブの欄の値もそのまま保存する。方式を切り替えて
 * 保存し直したときに反対側の入力が消えないようにするため(`FireGoal`の型コメント参照)。
 */
export const toFireGoal = (values: FireGoalFormValues): FireGoal => ({
  mode: values.mode,
  targetAmount: toOptionalNumber(values.targetAmount),
  annualExpense: toOptionalNumber(values.annualExpense),
  withdrawalRate: toOptionalNumber(values.withdrawalRate),
});

/**
 * 保存済みのFIRE目標をフォームの初期値に変換する。未設定(`null`)なら既定値を返す。
 *
 * 逆算係数だけは未入力を空欄にせず既定値(4%)を入れる。要件が「デフォルト値ありで編集可能」と
 * している欄であり(docs/screen-requirements-fire-goal.md B8)、空欄から始めると
 * 4%ルールを使うだけのユーザーにも入力を求めることになるため。
 */
export const toFireGoalFormValues = (goal: FireGoal | null): FireGoalFormValues => {
  if (goal === null) {
    return {
      mode: DEFAULT_FIRE_GOAL_MODE,
      targetAmount: "",
      annualExpense: "",
      withdrawalRate: String(DEFAULT_WITHDRAWAL_RATE),
    };
  }

  return {
    mode: goal.mode,
    targetAmount: goal.targetAmount === null ? "" : String(goal.targetAmount),
    annualExpense: goal.annualExpense === null ? "" : String(goal.annualExpense),
    withdrawalRate:
      goal.withdrawalRate === null ? String(DEFAULT_WITHDRAWAL_RATE) : String(goal.withdrawalRate),
  };
};

/**
 * 入力中の文字列から、参考表示に使える数値を取り出す。取れなければ`null`。
 *
 * 達成率や逆算結果は入力しながら更新する(HTMLモックの`field-hint`)。この時点の値は
 * まだバリデーションを通っていないので、`toFireGoal`とは別にここで形式を確かめる。
 */
export const toPreviewNumber = (value: string, pattern: RegExp): number | null => {
  if (!pattern.test(value)) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};
