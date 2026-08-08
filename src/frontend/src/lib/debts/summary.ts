import { MONTHS_PER_YEAR } from "@/constants/debts";

/**
 * B1の負債サマリが使う並べ替えと表示整形(docs/screen-requirements-dashboard.md B1「負債サマリ」)。
 *
 * B11のフォームは登録順で並べるため、金額順はここでだけ行う。表示の都合をリポジトリへ
 * 持ち込まないようにする(取得順は`fetchDebts`の責務)。
 */

/**
 * 残債の多い順に並べ替える。
 *
 * B11の並び順(登録順)ではなく金額順にするのは、負債サマリが「いま何をどれだけ
 * 返済中か」を把握するための表示のため。残債が同額のときは登録順(引数の順)を保つ。
 *
 * 引数の配列は変更しない。呼び出し側が同じ配列を合計にも使うため、破壊的に並べ替えると
 * 表示の都合が他の計算へ漏れる。
 */
export const sortDebtsByBalance = (debts: Debt[]): Debt[] =>
  [...debts].sort((left, right) => right.balance - left.balance);

/**
 * 金利の表示。**未登録は空文字**にして0%とは区別する
 * (docs/screen-requirements-dashboard.md B1「負債サマリ」)。
 */
export const formatDebtInterestRate = (interestRate: number | null): string =>
  interestRate === null ? "" : `${interestRate}%`;

/**
 * 残りの返済期間の表示。総月数を「◯年◯ヶ月」に組み立て直す(B11の入力欄と同じ単位)。
 *
 * **未登録は空文字**にして0ヶ月とは区別する。0ヶ月(総月数0)は「0ヶ月」と出す —
 * 「返済期間が残っていない」という登録された事実であり、未登録とは意味が違う。
 * 年または月のどちらかが0の場合はその側を省く(「5年」「4ヶ月」)。
 */
export const formatRepaymentPeriod = (repaymentMonths: number | null): string => {
  if (repaymentMonths === null) {
    return "";
  }

  const years = Math.floor(repaymentMonths / MONTHS_PER_YEAR);
  const months = repaymentMonths % MONTHS_PER_YEAR;

  if (years === 0) {
    return `${months}ヶ月`;
  }

  return months === 0 ? `${years}年` : `${years}年${months}ヶ月`;
};

/**
 * 負債サマリに出す最終更新日。**いちばん新しい保存日**を1つ出す。
 *
 * 負債はB11で画面全体を一括保存するため、最終更新日は本来すべて揃う。それでも最大値を
 * 採るのは、履歴の上限などで一部の保存が拒否された場合に古い日付を出さないため。
 * 1件も無い場合は`null`(カードは空状態を出すのでこの値を使わない)。
 */
export const resolveLatestUpdatedAt = (debts: Debt[]): string | null =>
  debts.reduce<string | null>(
    (latest, debt) => (latest === null || debt.updatedAt > latest ? debt.updatedAt : latest),
    null,
  );
