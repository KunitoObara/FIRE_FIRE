/**
 * 金額の表示整形。
 *
 * DESIGN.md 1章のとおり、桁の読み違いを避けることを優先して3桁区切り・通貨単位を必ず添える。
 * 資産額は円単位の整数で扱うため小数は出さない。
 */
const jpyFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

/** 億単位に丸めた概数用。1億〜10億の間は整数だけだと粗すぎるため小数第1位まで残す */
const compactJpyFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
});

/** `¥ 49,600,000` の形に整形する */
export const formatJpy = (amount: number): string => `¥ ${jpyFormatter.format(Math.round(amount))}`;

/**
 * 収支のように符号自体が意味を持つ金額を `+ ¥ 134,700` の形に整形する。
 *
 * プラス/マイナスを色だけで示すと色覚特性によっては区別できないため、必ず符号を添える
 * (`globals.css`の`--success`のコメントと対応)。
 */
export const formatSignedJpy = (amount: number): string => {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "+";
  return `${sign} ¥ ${jpyFormatter.format(Math.abs(rounded))}`;
};

/**
 * 総資産推移グラフの軸ラベル用に、桁数を落とした概数へ整形する。
 * 軸に`49,600,000`のような値が並ぶと読み取れないため、万/億で丸める。
 */
export const formatCompactJpy = (amount: number): string => {
  const rounded = Math.round(amount);
  const absolute = Math.abs(rounded);

  if (absolute >= 100_000_000) {
    return `${compactJpyFormatter.format(Math.round(rounded / 10_000_000) / 10)}億`;
  }

  if (absolute >= 10_000) {
    return `${jpyFormatter.format(Math.round(rounded / 10_000))}万`;
  }

  return jpyFormatter.format(rounded);
};

/** 構成比(0〜1)を `45%` の形に整形する */
export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;
