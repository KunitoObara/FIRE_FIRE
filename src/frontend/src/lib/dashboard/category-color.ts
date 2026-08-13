import {
  CATEGORY_COLOR_SLOT_COUNT,
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  DEBT_CATEGORY_NAME,
  OTHER_CATEGORY_ID,
  OTHER_CATEGORY_NAME,
} from "@/constants/dashboard";

/**
 * 個別の色を割り当てられる分類の数。
 * 分類がスロット数に収まるなら全て個別の色にできる。溢れる場合だけ最後のスロットを
 * 「その他」に使うため、1つ減る。
 */
const resolveIndividualSlotCount = (categories: AssetCategory[]): number =>
  categories.length > CATEGORY_COLOR_SLOT_COUNT
    ? CATEGORY_COLOR_SLOT_COUNT - 1
    : CATEGORY_COLOR_SLOT_COUNT;

/**
 * 分類マスタの登録順を色スロットへ割り当てた一覧を作る。溢れた分の受け皿として
 * 「その他」を末尾に足す(溢れていなければ足さない)。
 *
 * **分類別内訳の円グラフと資産推移グラフの積み上げ表示が、この1つの割り当てを共有する。**
 * 同じ画面に並ぶ2つのグラフで同じ資産種別が違う色になると、内訳と推移を見比べられない
 * (docs/screen-requirements-dashboard.md B1「積み上げ表示」/ DESIGN.md 3章)。
 *
 * 渡す`categories`は直近1日の資産残高に現れる資産種別で、**符号で絞らない**
 * (`collectAssetCategories`)。マイナス残高の資産種別も固有の色と凡例を持つ。
 */
export const buildCategoryColorSlots = (categories: AssetCategory[]): NetWorthTrendBand[] => {
  const individualSlotCount = resolveIndividualSlotCount(categories);

  const slots: NetWorthTrendBand[] = categories
    .slice(0, individualSlotCount)
    .map((category, index) => ({
      categoryId: category.id,
      name: category.name,
      color: `var(--chart-${index + 1})`,
    }));

  if (categories.length > individualSlotCount) {
    slots.push({
      categoryId: OTHER_CATEGORY_ID,
      name: OTHER_CATEGORY_NAME,
      color: `var(--chart-${CATEGORY_COLOR_SLOT_COUNT})`,
    });
  }

  return slots;
};

/**
 * 資産推移グラフの積み上げ表示に渡す帯と各点を、まとめて組み立てる。
 *
 * **帯と点を1つの関数で返す。** 別々に作ると、帯に無いキーを点が持つ(描かれない額が
 * できる)・点に無い帯が凡例に並ぶ、といったずれが起こりうる。
 *
 * 色スロットの割り当ては分類別内訳の円グラフと共有する(`buildCategoryColorSlots`)。
 * `categories`は直近1日の資産残高に現れる資産種別なので、**過去にだけ保有していた
 * 資産種別はここに無く、「その他」へまとめられる**(docs/screen-requirements-dashboard.md
 * B1「積み上げ表示」。許容と決めた挙動)。
 *
 * **`categories`がスロットをちょうど使い切っている(8件)ところへ過去だけの資産種別が
 * 現れた場合に限り、「その他」の色が8番目の資産種別と同じになる。** 円グラフ側の色を
 * 動かしてまで避けない — 同じ資産種別が2つのグラフで違う色になるほうが、このカードの
 * 目的そのものを外すため。どちらも凡例に名前が出る。
 *
 * 帯に出すのは**期間内のどこかで0以外の額を持つもの**だけにする。全点で0の帯は、
 * 面としては見えないまま凡例だけを埋める。
 */
export const buildStackedTrend = (
  series: NetWorthPoint[],
  categories: AssetCategory[],
  includeDebt: boolean,
): { bands: NetWorthTrendBand[]; points: NetWorthStackedPoint[] } => {
  const slots = buildCategoryColorSlots(categories);
  const individualSlotIds = new Set(
    slots.filter((slot) => slot.categoryId !== OTHER_CATEGORY_ID).map((slot) => slot.categoryId),
  );

  // どのスロットに寄せるか。スロットを持たない資産種別(過去だけの保有・溢れた分)は「その他」へ
  const toSlotId = (assetTypeName: string): string =>
    individualSlotIds.has(assetTypeName) ? assetTypeName : OTHER_CATEGORY_ID;

  const usedSlotIds = new Set<string>();

  const points = series.map((point) => {
    const amounts: Record<string, number> = {};

    Object.entries(point.byType).forEach(([assetTypeName, amount]) => {
      const slotId = toSlotId(assetTypeName);

      amounts[slotId] = (amounts[slotId] ?? 0) + amount;
    });

    Object.entries(amounts).forEach(([slotId, amount]) => {
      if (amount !== 0) {
        usedSlotIds.add(slotId);
      }
    });

    /*
      負債は0より下の帯として積むので、額に-1を掛けて持つ(docs/screen-requirements-dashboard.md
      B1「積み上げ表示」)。差し引くのではなく負の帯として積むため、面の上端(正の帯の合計)は
      負債の有無で動かない。項目ごとには分けず、円グラフの負債スライスと同じく1本にまとめる
    */
    if (includeDebt && point.debtBalance !== 0) {
      amounts[DEBT_CATEGORY_ID] = -point.debtBalance;
      usedSlotIds.add(DEBT_CATEGORY_ID);
    }

    return {
      date: point.date,
      /*
        ツールチップに出す合計は**行に並べた額の総和**で、負の資産種別も符号のまま加える
        (同要件B1)。負債反映ONのときは負債の行(負の値)も含むので、合計はその時点の
        純資産そのものになる。面の上端(正の帯だけの合計)とは一致しないことがある。
        `point.amount`(純額)を使わないのは、こちらが「0円以下の資産種別を除く」等の
        フィルタと無関係に組み立てた行の総和であるべきだから
      */
      total: Object.values(amounts).reduce((sum, amount) => sum + amount, 0),
      amounts,
    };
  });

  const bands = slots.filter((slot) => usedSlotIds.has(slot.categoryId));

  /*
    「その他」はスロットが溢れたときにしか`buildCategoryColorSlots`に現れないが、
    過去にだけ保有していた資産種別の受け皿としても要る。溢れていない場合はここで足す
  */
  if (
    usedSlotIds.has(OTHER_CATEGORY_ID) &&
    !bands.some((band) => band.categoryId === OTHER_CATEGORY_ID)
  ) {
    bands.push({
      categoryId: OTHER_CATEGORY_ID,
      name: OTHER_CATEGORY_NAME,
      color: `var(--chart-${CATEGORY_COLOR_SLOT_COUNT})`,
    });
  }

  /*
    負債の帯は**資産種別のスロット順の後ろに固定**する(同要件B1「積み上げ表示」)。
    描かれる位置は0より下だが、凡例の並びは常に「資産種別 → 負債」になる。
    色スロット(--chart-1〜8)は消費せず、円グラフの負債スライスと同じ固定色を使う
    (DESIGN.md 3章)。実際に保有している資産の分類が「その他」へ押し出されないため
  */
  if (usedSlotIds.has(DEBT_CATEGORY_ID)) {
    bands.push({
      categoryId: DEBT_CATEGORY_ID,
      name: DEBT_CATEGORY_NAME,
      color: DEBT_CATEGORY_COLOR,
    });
  }

  return { bands, points };
};

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

  const individualSlotCount = resolveIndividualSlotCount(categories);

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
    (0円のスライスは凡例を埋めるだけになるため)。

    出さないのは**ちょうど0円のとき**であって、資産種別に掛けている「0円以下を除く」
    フィルタ(`buildAxisBreakdown`)とは別のものである。残債は0以上なので負債では差が
    出ないが、同じ擬似分類の不動産(B4-8、未実装)は利ざやが負になりうるため、そちらは
    絶対値で面積を取って描く(docs/screen-requirements-dashboard.md B1「不動産を含む
    分類軸の集計」の「グラフでの見せ方」で2つまとめて決めてある)
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
