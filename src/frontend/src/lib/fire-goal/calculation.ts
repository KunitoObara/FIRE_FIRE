/**
 * FIRE目標の逆算(B8)。
 *
 * 達成率そのものは`src/lib/dashboard/fire-progress.ts`の`calculateAchievementRate`を使う。
 * B1のゲージとB8の参考表示で別々に計算すると、同じ「達成率」が画面によって違う値になりうるため。
 */

/**
 * 想定年間支出額と逆算係数から目標資産額を求める(要件定義書 4.6)。
 *
 * 逆算係数はパーセントの数値で受ける(4%ルールなら`4`)。式は
 * `目標資産額 = 年間支出額 ÷ (逆算係数 ÷ 100)` で、4%なら年間支出額の25倍になる。
 *
 * 係数が0以下だと除算が成立しない(0除算は`Infinity`になる)ため`null`を返し、
 * 呼び出し側では「まだ算出できない」扱いにする。入力側でも0以下は弾いているが、
 * 保存済みのデータから計算するときにこの関数だけで完結できるようにしておく。
 *
 * 円未満は四捨五入する。資産額を円単位の整数で扱う方針(`formatJpy`)に合わせ、
 * 保存する目標額と画面に出す目標額がずれないようにするため。
 */
export const calculateTargetFromAnnualExpense = (
  annualExpense: number,
  withdrawalRatePercent: number,
): number | null => {
  if (withdrawalRatePercent <= 0) {
    return null;
  }

  return Math.round((annualExpense * 100) / withdrawalRatePercent);
};

/**
 * 有効な設定方式に応じた目標資産額を求める。
 *
 * 直接入力なら入力値そのもの、逆算なら年間支出額と係数から導いた額を返す。
 * 有効な方式の欄が埋まっていない(未設定の方式に切り替えた直後など)場合は`null`。
 *
 * 「どちらの方式が有効か」の解釈をこの1か所に閉じ込める。B8の参考表示と、
 * のちにB1のゲージへ渡す値が別々の判断で導かれないようにするため。
 */
export const resolveFireGoalTargetAmount = (goal: FireGoal): number | null => {
  if (goal.mode === "direct") {
    return goal.targetAmount;
  }

  if (goal.annualExpense === null || goal.withdrawalRate === null) {
    return null;
  }

  return calculateTargetFromAnnualExpense(goal.annualExpense, goal.withdrawalRate);
};
