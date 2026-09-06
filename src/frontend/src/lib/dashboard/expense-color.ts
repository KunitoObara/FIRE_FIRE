import {
  CATEGORY_COLOR_SLOT_COUNT,
  EXPENSE_COLOR_LIGHTNESS,
  EXPENSE_COLOR_MAX_CHROMA,
  EXPENSE_COLOR_START_HUE,
} from "@/constants/dashboard";
import { formatOklch, resolveInGamutChroma } from "@/lib/color/oklch";

/**
 * 費目別支出を、色と構成比を解決した円グラフ用の形へ変換する(B1の収支サマリ)。
 *
 * **その月に現れた大項目を全て個別のスライスとして出す**([B1-18](https://trello.com/c/UTWWqbpy))。
 * 以前は8スロットに収まらない費目を「ほかの費目」へまとめていたが、マネーフォワードの大項目は
 * 15前後あるため、9件以上の月は常に7件までしか個別に出ず、**税・社会保障費や日用品といった
 * 生活費の見直しに要る費目が受け皿に消えていた**。
 *
 * **資産分類カラー(`category-color.ts`)とは割り当ての軸が別。** 同じ画面で「投資信託」と「食費」に
 * 同じ色が当たることはあるが、**色の一致に意味は無い** — 資産と費目は別の軸の内訳で、見比べる
 * 関係にない(見比べる相手がある資産推移グラフと分類別内訳が同じ割り当てを使うのとは事情が違う。
 * DESIGN.md 3章)。
 *
 * **並びは金額の多い順。** 個別の色は支出の大きい費目から順に付く。DESIGN.md 3章は
 * 「順位が入れ替わるたびに同じ費目の色が変わる」ことを理由に金額順を却下していたが、費目には
 * そもそも**月をまたぐと色が変わりうる**ことが認められている(費目マスタを持たない方針の帰結。
 * docs/transaction-import-requirements.md 6章)ので、費目に対しては却下の理由が成り立たない。
 * 金額が同じ費目は費目名の順で並べ、実行のたびに順序が動かないようにする。
 *
 * **月をまたぐと同じ費目の色は変わる。** 金額の順位が動くだけでなく、費目の件数が8と9の境目を
 * またぐと配色の作り方自体が切り替わるため。「切り替えても同じ分類は同じ色」は資産分類カラーの
 * 約束であって、マスタを持たない費目に同じ保証は置けない
 * (docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。凡例に費目名を出すことで、
 * 色が動いても費目を読み違えないようにしている。
 */

/**
 * 費目が8件以下のときに使う、末尾から数えて`position`番目(0始まり)のスロットの色。
 *
 * `position`が0で`--chart-8`、1で`--chart-7`。**資産側が`--chart-1`から昇順に配るので、
 * こちらは降順に配る**([B11-9-2](https://trello.com/c/zh3egdfo))。両方を先頭から埋めると、
 * 同じ画面に並ぶ2つの円グラフで無関係な資産種別と費目が同じ色になる組み合わせが構造的に
 * 起きる(どちらも件数が少ない普通の月ほど確実に重なる)。
 */
const slotColor = (position: number): string =>
  `var(--chart-${CATEGORY_COLOR_SLOT_COUNT - position})`;

/**
 * 費目が9件以上のときに使う、件数ぶんの色。色相を等間隔に取って作る。
 *
 * **9色目を`--chart-*`に足す形にはできない。** パレットは隣り合うスロットの識別性を検証した
 * うえで8色に決めてあり(DESIGN.md 3章)、機械的に増やすと識別できない色同士が並ぶ。かといって
 * 受け皿へまとめるとこのカードが解こうとしている問題に戻るので、**8色の枠組み自体を費目に
 * 限って外す**。
 *
 * **生成した色は事前に識別性を検証できない。** 件数が実行時に決まる以上、隣接ペアを検証してから
 * 使うことが原理的にできない。費目が増えるほど色相の間隔は詰まり、隣り合うスライスの区別は
 * 付きにくくなる。**読み違えを防ぐのは凡例の費目名**であり、これは以前から色に頼らせない
 * 作りになっている(凡例に色見本・費目名・構成比・金額を並べる。同要件B1)。
 *
 * 明度は固定し、彩度は色相ごとにsRGBへ収まる値まで落とす(`resolveInGamutChroma`)。彩度まで
 * 固定すると色相環の半分以上が色域の外に出てブラウザ任せの丸めが入る。
 */
const generateColors = (count: number): string[] => {
  const hueStep = 360 / count;

  return Array.from({ length: count }, (unused, index) => {
    const hue = (EXPENSE_COLOR_START_HUE + index * hueStep) % 360;
    const chroma = resolveInGamutChroma(EXPENSE_COLOR_LIGHTNESS, hue, EXPENSE_COLOR_MAX_CHROMA);

    return formatOklch(EXPENSE_COLOR_LIGHTNESS, chroma, hue);
  });
};

/**
 * 費目の件数に応じた色の一覧。
 *
 * **8件以下は既存の`--chart-*`をそのまま使う。** 8色は手で選んで識別性を検証した値で、
 * 色相が等間隔ではない(緑が2つ、赤系が2つある)ため生成では再現できない。常に生成へ
 * 切り替えると、費目が少ない普通の月の見た目まで検証済みの色から離れる。
 */
const resolveColors = (count: number): string[] =>
  count > CATEGORY_COLOR_SLOT_COUNT
    ? generateColors(count)
    : Array.from({ length: count }, (unused, index) => slotColor(index));

export const buildExpenseSlices = (expenses: ExpenseByCategory[]): ExpenseBreakdownSlice[] => {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  /*
    構成比の分母はその月の支出合計。費目別支出は全て0以上で、負債スライスのような符号の違う
    スライスが無いので、%はそのまま支出に占める割合になる(同要件B1)
  */
  const toRatio = (amount: number): number => (total === 0 ? 0 : amount / total);

  /*
    金額の多い順。同額のときは費目名の順で並べる — 同額が並ぶ月に`sort`の安定性と
    渡された順に結果が依存すると、同じデータでも表示が変わりうる
  */
  const sorted = [...expenses].sort(
    (left, right) => right.amount - left.amount || left.name.localeCompare(right.name, "ja"),
  );
  const colors = resolveColors(sorted.length);

  return sorted.map((expense, index) => ({
    categoryId: expense.name,
    name: expense.name,
    amount: expense.amount,
    ratio: toRatio(expense.amount),
    // 件数ぶん作ってあるので必ず存在するが、型の上では省略可能なので既定を置く
    color: colors[index] ?? slotColor(0),
  }));
};
