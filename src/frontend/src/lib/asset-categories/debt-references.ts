/**
 * 分類軸が参照している負債のうち、B11で削除されたものを見分ける
 * (docs/screen-requirements-dashboard.md B4)。
 *
 * B4は分類軸に負債IDの配列を持つが、B11の削除は禁止していない(完済した負債を整理
 * できなくなるため)。参照だけが残った状態は正常に起こりうるもので、エラーではない。
 */

/**
 * 分類軸の負債参照の内訳を求める。
 *
 * **負債の選択肢が読み込み中・取得失敗のあいだは`null`を返す。** 登録済みの負債が
 * 分からない状態では削除済みかどうかを判定できず、「取得に失敗しただけ」を
 * 「削除された」と読ませることになるため(B4)。呼び出し側はこのとき件数の内訳を
 * 出さず、参照をそのまま扱う。
 */
export const resolveCategoryAxisDebtReferences = (
  debtIds: string[],
  debtOptions: DebtOptionsState,
): CategoryAxisDebtReferences | null => {
  if (debtOptions.status !== "ready") {
    return null;
  }

  const existingIds = new Set(debtOptions.debts.map((debt) => debt.id));
  const activeIds = debtIds.filter((debtId) => existingIds.has(debtId));

  return { activeIds, missingCount: debtIds.length - activeIds.length };
};
