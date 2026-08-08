import {
  CATEGORY_COLOR_SLOT_COUNT,
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  DEBT_CATEGORY_NAME,
  OTHER_CATEGORY_ID,
  OTHER_CATEGORY_NAME,
} from "@/constants/dashboard";

/**
 * 分類別内訳を、色と構成比を解決した表示用の形へ変換する。
 *
 * **色は分類そのものに紐づける。** 金額順・表示順といった「その時の並び」に色を割り当てると、
 * 分類軸や期間を切り替えるたびに同じ分類の色が変わり、グラフを見比べられなくなる。
 * ここでは分類マスタ(B4)の登録順のインデックスをそのまま色スロットに対応させるため、
 * 分類が増減しても既存の分類の色は変わらない。分類名やIDに色を決め打ちすることもない
 * (DESIGN.md 3章)。
 *
 * 返す並び順もマスタの登録順に固定する。円グラフでは隣り合うスライスの色の識別性が問題になるが、
 * パレットは「スロットの並び順で隣接するペア」について色覚特性込みで検証してあるため
 * (`globals.css`の`--chart-*`のコメント参照)、描画順をスロット順と一致させておく必要がある。
 *
 * 色スロットは8つしかないため、それを超える分類は「その他」へまとめる。
 * 足りない色を機械的に作って回すと、識別できない色同士が並ぶため増やさない。
 *
 * **負債(`debtTotal`)はスロットを消費しない。** 専用の固定色を持つ1スライスとして
 * 最後に足す(DESIGN.md 3章)。負債にスロットを1つ渡すと、実際に保有している資産の分類が
 * 「その他」へ押し出される。
 *
 * 負債のスライスを置くと**構成比の分母が「資産合計 + 負債合計」に変わる**。円グラフは
 * 正の面積でしか比を表せないため、面積は残債の絶対値で取るしかない。%が純資産に対する
 * 割合ではないことは、カード側が差引後の純額を併記して示す
 * (docs/screen-requirements-dashboard.md B1)。
 */
export const buildBreakdownSlices = (
  entries: AssetBreakdownEntry[],
  categories: AssetCategory[],
  debtTotal = 0,
): AssetBreakdownSlice[] => {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0) + debtTotal;
  const toRatio = (amount: number): number => (total === 0 ? 0 : amount / total);

  // 分類がスロット数に収まるなら全て個別の色にできる。溢れる場合だけ最後のスロットを「その他」に使う
  const individualSlotCount =
    categories.length > CATEGORY_COLOR_SLOT_COUNT
      ? CATEGORY_COLOR_SLOT_COUNT - 1
      : CATEGORY_COLOR_SLOT_COUNT;

  const slices: AssetBreakdownSlice[] = [];
  let otherAmount = 0;

  entries.forEach((entry) => {
    const index = categories.findIndex((category) => category.id === entry.categoryId);
    const category = categories[index];

    // マスタから消えた分類がデータ側に残っている場合もここに落ちる
    if (category === undefined || index >= individualSlotCount) {
      otherAmount += entry.amount;
      return;
    }

    slices.push({
      categoryId: category.id,
      name: category.name,
      amount: entry.amount,
      ratio: toRatio(entry.amount),
      color: `var(--chart-${index + 1})`,
    });
  });

  // 登録順に並べる。entriesの並びには依存させない
  slices.sort(
    (left, right) =>
      categories.findIndex((category) => category.id === left.categoryId) -
      categories.findIndex((category) => category.id === right.categoryId),
  );

  if (otherAmount > 0) {
    slices.push({
      categoryId: OTHER_CATEGORY_ID,
      name: OTHER_CATEGORY_NAME,
      amount: otherAmount,
      ratio: toRatio(otherAmount),
      color: `var(--chart-${CATEGORY_COLOR_SLOT_COUNT})`,
    });
  }

  /*
    負債は最後に置く。資産のスライスの並び(分類マスタの登録順)を崩さないためと、
    符号の違うものを資産の間に挟まないため。残債の合計が0円のときはスライスを出さない
    (0円以下の資産種別を除いているのと同じ理由。0円のスライスは凡例を埋めるだけになる)
  */
  if (debtTotal > 0) {
    slices.push({
      categoryId: DEBT_CATEGORY_ID,
      name: DEBT_CATEGORY_NAME,
      amount: debtTotal,
      ratio: toRatio(debtTotal),
      color: DEBT_CATEGORY_COLOR,
    });
  }

  return slices;
};
