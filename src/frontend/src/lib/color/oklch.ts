/**
 * OKLCHの色をsRGBの色域に収めるための計算。
 *
 * **費目別支出の円グラフ(B1)が色を実行時に作るためだけに置いている**([B1-18](https://trello.com/c/UTWWqbpy))。
 * 分類別内訳や資産推移グラフが使う`--chart-1`〜`--chart-8`は手で選んで識別性を検証した固定値で
 * (DESIGN.md 3章)、そちらの色をここで作ることはない。
 *
 * **なぜ色域の判定が要るか。** CSSの`oklch()`は色域の外の値も書けてしまい、その場合ブラウザが
 * 暗黙に色域へ丸める。丸め方は実装任せなので、**等間隔に取ったはずの色相が隣同士で同じ色に
 * 潰れることがある**。既存パレットと同じ彩度(C≈0.165)で明度を固定したまま色相を1周させると、
 * 色相環の**半分以上がsRGBの外**に出る(L=0.62で175/360度)。丸めをブラウザに任せず、
 * ここで色域に収まる彩度まで落としてから文字列にする。
 */

/** OKLab→線形sRGBの行列(https://bottosson.github.io/posts/oklab/) */
const oklchToLinearSrgb = (
  lightness: number,
  chroma: number,
  hue: number,
): [number, number, number] => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

/**
 * その明度・彩度・色相がsRGBで表せるか。
 *
 * 比較に余裕(`1e-4`)を持たせてあるのは、境界ぴったりの値が浮動小数の誤差だけで
 * 色域外と判定されるのを避けるため。丸めた先が1/255の階調に載る以上、この幅で見え方は変わらない。
 */
const isInSrgbGamut = (lightness: number, chroma: number, hue: number): boolean =>
  oklchToLinearSrgb(lightness, chroma, hue).every(
    (channel) => channel >= -1e-4 && channel <= 1 + 1e-4,
  );

/** 二分探索の回数。彩度の範囲(0〜0.4程度)をこの回数で割れば、階調に載らない精度まで詰められる */
const CHROMA_SEARCH_STEPS = 20;

/**
 * その明度・色相でsRGBに収まる彩度を返す。`maxChroma`が収まるならそのまま返す。
 *
 * **色相と明度は動かさず、彩度だけを落とす。** 色相を動かすと等間隔という前提が崩れ、
 * 明度を動かすと同じ円グラフの中でスライスの明るさがばらつく。彩度は落ちても
 * 「その色相のいちばん鮮やかな色」であることは保たれる。
 */
export const resolveInGamutChroma = (lightness: number, hue: number, maxChroma: number): number => {
  if (isInSrgbGamut(lightness, maxChroma, hue)) {
    return maxChroma;
  }

  let low = 0;
  let high = maxChroma;

  for (let step = 0; step < CHROMA_SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;

    if (isInSrgbGamut(lightness, middle, hue)) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low;
};

/**
 * CSSの`oklch()`の文字列を組み立てる。
 *
 * 彩度は`resolveInGamutChroma`で色域に収めてから渡すこと。桁を3桁で切るのは、
 * それ以上の精度がsRGBの階調(1/255)に載らないため — テストが実際の色を文字列で
 * 突き合わせられるように、値を安定させる意味もある。
 */
export const formatOklch = (lightness: number, chroma: number, hue: number): string =>
  `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
