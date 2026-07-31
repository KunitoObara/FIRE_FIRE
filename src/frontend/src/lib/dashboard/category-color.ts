import {
  CATEGORY_COLOR_SLOT_COUNT,
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
 */
export const buildBreakdownSlices = (
  entries: AssetBreakdownEntry[],
  categories: AssetCategory[],
): AssetBreakdownSlice[] => {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
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

  return slices;
};
