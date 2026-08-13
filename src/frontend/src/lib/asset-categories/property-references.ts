/**
 * 分類軸が参照している物件のうち、削除されたものを見分ける
 * (docs/screen-requirements-dashboard.md B4「集計対象に不動産を含める」)。
 *
 * 扱いは負債(`debt-references.ts`)とすべて同じ。物件の削除は禁止しない方針なので
 * (売却した物件を整理できなくなるため。screen-requirements-real-estate.md「物件の削除」)、
 * 参照だけが残った状態は正常に起こりうるものでエラーではない。
 *
 * **物件の削除自体はまだ実装されていない**([B6-1](https://trello.com/c/0Frlp1Q1))。それでも
 * 先に用意するのは、B6-1が入った時点で分類軸側の扱いが決まっていないと、削除された物件を
 * 参照したままの軸が誰にも扱われない状態で残るため(B4-8のリファインメントで決めた分担)。
 */

/**
 * 分類軸の物件参照の内訳を求める。
 *
 * **物件の選択肢が読み込み中・取得失敗のあいだは`null`を返す。** 登録済みの物件が
 * 分からない状態では削除済みかどうかを判定できず、「取得に失敗しただけ」を
 * 「削除された」と読ませることになるため(B4)。呼び出し側はこのとき件数の内訳を
 * 出さず、参照をそのまま扱う。
 *
 * 負債と違って返すのが**ID配列ではなくマップ**なのは、フォームの初期値が「どの物件を
 * どちらの額で反映するか」そのものだから。IDだけを返すと呼び出し側で反映方法を引き直す
 * ことになり、一覧の件数とフォームの初期値が別々の絞り込みから出ることになる。
 */
export const resolveCategoryAxisPropertyReferences = (
  propertyValuations: CategoryAxisPropertyValuations,
  propertyOptions: PropertyOptionsState,
): CategoryAxisPropertyReferences | null => {
  if (propertyOptions.status !== "ready") {
    return null;
  }

  const existingIds = new Set(propertyOptions.properties.map((property) => property.id));
  const entries = Object.entries(propertyValuations);
  const activeEntries = entries.filter(([propertyId]) => existingIds.has(propertyId));

  return {
    activeValuations: Object.fromEntries(activeEntries),
    missingCount: entries.length - activeEntries.length,
  };
};
