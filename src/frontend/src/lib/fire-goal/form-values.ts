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
 * 毎月の積立額を保存する数値に変換する。**未入力は`null`ではなく0で保存する。**
 *
 * 要件が「未入力は0(積立なし)として扱う」としている(docs/screen-requirements-fire-goal.md
 * B8「毎月の積立額」)ことに加えて、`null`で保存すると次にB8を開いたときに前月の収支が
 * また初期値として提示される。意図して空にした設定が、次の保存で気付かないうちに前月の収支へ
 * 化けることになるため、空欄のまま保存した時点で「積立なし」と決まったものとして0を書く。
 *
 * `null`が入るのは積立額を導入する前に保存された目標だけで、そこにだけ初期値の提示が働く。
 */
const toMonthlyContribution = (value: string): number => {
  const parsed = toOptionalNumber(value);

  return parsed ?? 0;
};

/**
 * 入力値を保存する形に変換する。**バリデーション通過後の値にのみ使う**
 * (形式は`fireGoalFormSchema`が保証している)。
 *
 * 有効な方式の欄だけでなく、非表示タブの欄の値もそのまま保存する。方式を切り替えて
 * 保存し直したときに反対側の入力が消えないようにするため(`FireGoal`の型コメント参照)。
 *
 * 達成度の対象分類だけは別の引数で受ける。タブの外にある共通の設定で、選択肢からの選択なので
 * 文字列と数値の変換もバリデーションも要らず、フォームの入力値(`FireGoalFormValues`)には
 * 含めていないため。
 */
export const toFireGoal = (
  values: FireGoalFormValues,
  achievementAxisId: string | null,
): FireGoal => ({
  mode: values.mode,
  targetAmount: toOptionalNumber(values.targetAmount),
  annualExpense: toOptionalNumber(values.annualExpense),
  withdrawalRate: toOptionalNumber(values.withdrawalRate),
  achievementAxisId,
  monthlyContribution: toMonthlyContribution(values.monthlyContribution),
});

/**
 * 保存済みのFIRE目標をフォームの初期値に変換する。未設定(`null`)なら既定値を返す。
 *
 * 逆算係数だけは未入力を空欄にせず既定値(4%)を入れる。要件が「デフォルト値ありで編集可能」と
 * している欄であり(docs/screen-requirements-fire-goal.md B8)、空欄から始めると
 * 4%ルールを使うだけのユーザーにも入力を求めることになるため。
 *
 * **毎月の積立額は保存済みの値を優先し、無い場合にだけ前月の収支(`prefilledMonthlyContribution`)を
 * 入れる。** 保存した値がそのまま到達予測に使われる、という関係を崩さないため
 * (要件B8「提示するのは画面を開いた時点の初期値だけで、保存後に追従して変わることはしない」)。
 * 前月の収支は提示できないこともあるので`null`を受け付け、そのときは空欄にする。
 */
export const toFireGoalFormValues = (
  goal: FireGoal | null,
  prefilledMonthlyContribution: number | null,
): FireGoalFormValues => {
  /*
    `??`で受けるので、保存済みの0(「積立なし」と決めた設定)は前月の収支で上書きされない。
    truthyかどうかで書くと0だけが提示に差し替わる(CODING_STANDARDS.md 2章)
  */
  const contribution = goal?.monthlyContribution ?? prefilledMonthlyContribution;
  const monthlyContribution = contribution === null ? "" : String(contribution);

  if (goal === null) {
    return {
      mode: DEFAULT_FIRE_GOAL_MODE,
      targetAmount: "",
      annualExpense: "",
      withdrawalRate: String(DEFAULT_WITHDRAWAL_RATE),
      monthlyContribution,
    };
  }

  return {
    mode: goal.mode,
    targetAmount: goal.targetAmount === null ? "" : String(goal.targetAmount),
    annualExpense: goal.annualExpense === null ? "" : String(goal.annualExpense),
    withdrawalRate:
      goal.withdrawalRate === null ? String(DEFAULT_WITHDRAWAL_RATE) : String(goal.withdrawalRate),
    monthlyContribution,
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
