import { DEBT_INTEGER_PATTERN } from "@/constants/debts";
import { formatJpy } from "@/lib/format/currency";

/**
 * B11のフォームの入力値から、画面が出す派生値(合計・削除対象・影響する分類軸)を求める。
 *
 * 保存前の入力値が相手なので`Debt`ではなくフォームの行を受け取る。フォームの内側で
 * 組み立てるとテストからは画面越しにしか確かめられなくなるため、純粋な関数に分けている。
 */

/**
 * 入力中の残債の合計。
 *
 * **形式エラーのある行は合計に入れない。** 読めない値を0円として黙って足すと、合計が
 * 実態とずれたまま画面に出る(HTMLモックの`updateTotal`と同じ扱い)。上限超過の行は
 * 数として読めるので合計に含める — 桁を打ち間違えた合計が目に入る方が気付きやすい。
 */
export const sumDebtFormBalances = (rows: DebtRowFormValues[]): number =>
  rows.reduce(
    (sum, row) => (DEBT_INTEGER_PATTERN.test(row.balance) ? sum + Number(row.balance) : sum),
    0,
  );

/**
 * 保存によって削除される負債(保存済みのうち、フォームの行に残っていないもの)。
 *
 * 表示用に項目名と整形済みの残債を組にして返す。項目名の重複を許す仕様のため、名前だけを
 * 並べると同名の負債が2件あるときにどちらが消えるのか確認できない
 * (docs/screen-requirements-dashboard.md B11)。残債は削除される負債の**保存済みの値**を
 * 出す。フォーム側の書きかけの値を出すと、実際に消えるものと表示が食い違う。
 */
export const buildDebtDeletionPreviews = (
  debts: Debt[],
  values: DebtFormValues,
): DebtDeletionPreview[] => {
  const keptIds = new Set(values.debts.flatMap((row) => (row.id === null ? [] : [row.id])));

  return debts
    .filter((debt) => !keptIds.has(debt.id))
    .map((debt) => ({ id: debt.id, name: debt.name, balance: formatJpy(debt.balance) }));
};

/**
 * 削除される負債を集計対象にしている分類軸の名前。
 *
 * 該当する軸は**すべて**返す(B11)。負債はチェックボックスで複数の分類軸から独立に
 * 選べるため、同じ負債を2つ以上の軸が対象にしていることがある。1つの軸が複数の削除対象を
 * 参照していても名前は1度だけ出す。
 */
export const collectAffectedAxisNames = (
  axes: AssetCategoryAxisDocument[],
  deletions: DebtDeletionPreview[],
): string[] => {
  const deletedIds = new Set(deletions.map((deletion) => deletion.id));

  return axes
    .filter((axis) => axis.debtIds.some((debtId) => deletedIds.has(debtId)))
    .map((axis) => axis.name);
};
