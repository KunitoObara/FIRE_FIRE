import {
  CATEGORY_COLOR_SLOT_COUNT,
  OTHER_EXPENSE_CATEGORY_ID,
  OTHER_EXPENSE_CATEGORY_NAME,
} from "@/constants/dashboard";

/**
 * 費目別支出を、色と構成比を解決した円グラフ用の形へ変換する(B1の収支サマリ)。
 *
 * **資産分類カラー(`category-color.ts`)とはパレットだけを共有し、割り当ての軸は別。**
 * 同じ画面で「投資信託」と「食費」に同じ色が当たることはあるが、**色の一致に意味は無い** —
 * 資産と費目は別の軸の内訳で、見比べる関係にない(見比べる相手がある資産推移グラフと
 * 分類別内訳が同じ割り当てを使うのとは事情が違う。DESIGN.md 3章)。
 *
 * **並びは費目名の順で決める。** 費目マスタは持たない方針なので
 * (docs/transaction-import-requirements.md 6章)、資産分類のような「マスタの登録順」が
 * そもそも無い。金額の多い順に配る案は採らない(DESIGN.md 3章。順位が入れ替わるたびに同じ費目の
 * 色が変わる)。
 *
 * **月をまたぐと同じ費目の色が変わりうる。** ある月にだけ現れる費目が名前順の並びを1つずらす
 * ため。「切り替えても同じ分類は同じ色」は資産分類カラーの約束であって、マスタを持たない費目に
 * 同じ保証は置けない(docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。
 * 凡例に費目名を出すことで、色が動いても費目を読み違えないようにしている。
 *
 * 並べ替えは資産種別と同じ`localeCompare(…, "ja")`で行う(`collectAssetCategories`と揃える)。
 */

/**
 * 個別の色を割り当てられる費目の数。
 *
 * **「ほかの費目」も8スロットのうち1つを使う。** 費目が8以下なら全てに個別の色が付き、
 * 9以上になった月だけ個別色が先頭7件に減る(資産分類カラーの`resolveIndividualSlotCount`と
 * 同じ数え方)。9色目は作らない — パレットは隣り合うスロットの識別性を検証したうえで8色に
 * 決めており、機械的に増やすと識別できない色同士が並ぶ(DESIGN.md 3章)。
 */
const resolveIndividualSlotCount = (categoryCount: number): number =>
  categoryCount > CATEGORY_COLOR_SLOT_COUNT
    ? CATEGORY_COLOR_SLOT_COUNT - 1
    : CATEGORY_COLOR_SLOT_COUNT;

export const buildExpenseSlices = (expenses: ExpenseByCategory[]): ExpenseBreakdownSlice[] => {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  /*
    構成比の分母はその月の支出合計。費目別支出は全て0以上で、負債スライスのような符号の違う
    スライスが無いので、%はそのまま支出に占める割合になる(同要件B1)
  */
  const toRatio = (amount: number): number => (total === 0 ? 0 : amount / total);

  const sorted = [...expenses].sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const individualSlotCount = resolveIndividualSlotCount(sorted.length);

  const slices: ExpenseBreakdownSlice[] = sorted
    .slice(0, individualSlotCount)
    .map((expense, index) => ({
      categoryId: expense.name,
      name: expense.name,
      amount: expense.amount,
      ratio: toRatio(expense.amount),
      color: `var(--chart-${index + 1})`,
    }));

  const overflowAmount = sorted
    .slice(individualSlotCount)
    .reduce((sum, expense) => sum + expense.amount, 0);

  /*
    溢れた費目は最後のスロットにまとめる。**擬似的な分類ID**で表し、表示名との一致では
    判定しない — 費目名はCSVの値そのもの(同書6章)で、マネーフォワードの大項目には
    「その他」が実在する。受け皿の表示名を「ほかの費目」にしてあるのも、同じ月に
    費目名「その他」があったときに凡例へ同じ名前が2行並ばないようにするため(PO判断)
  */
  if (overflowAmount > 0) {
    slices.push({
      categoryId: OTHER_EXPENSE_CATEGORY_ID,
      name: OTHER_EXPENSE_CATEGORY_NAME,
      amount: overflowAmount,
      ratio: toRatio(overflowAmount),
      color: `var(--chart-${CATEGORY_COLOR_SLOT_COUNT})`,
    });
  }

  return slices;
};
