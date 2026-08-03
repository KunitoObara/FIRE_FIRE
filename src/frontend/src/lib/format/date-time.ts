/**
 * 日時の表示整形。
 *
 * 金額(`currency.ts`)と同じく、読み違いを避けるため桁を省略しない形に揃える。
 * タイムゾーンは指定せず、閲覧している端末の設定に従う(単一ユーザー向けのため)。
 */
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * エポックミリ秒を `2026/07/30 21:52` の形に整形する。
 *
 * 値の出所はcallableの応答(リカバリーコードの発行日時など)で、想定外の値が来ても
 * 画面を壊さないよう、日時として解釈できない場合は`null`を返す。
 */
export const formatDateTime = (epochMilliseconds: number): string | null => {
  const date = new Date(epochMilliseconds);

  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date);
};
