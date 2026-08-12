import { format, parse } from "date-fns";

import { MONTH_KEY_FORMAT } from "@/constants/dashboard";

/**
 * 年月(`yyyy-MM`)の取り回し。収支サマリの対象月がこの形で、URLのクエリ・Firestoreの
 * 範囲クエリの境界・カードの見出しの表示がすべてここを通る
 * (docs/screen-requirements-dashboard.md B1「年月の選択」)。
 *
 * **`Date`ではなく文字列で持つ。** 対象は月であって時刻ではないので、`Date`で持つと
 * 「同じ月を指す違う値」が生まれ、キャッシュキー(`CASHFLOW_DATA_QUERY_KEY`)や
 * 再生の署名の一致判定に使えなくなる。
 */

/**
 * 年月として読める形かを見る。**月を01〜12に絞る**(B11の発生年月と同じ理由。
 * 桁だけを見る形だと`2026-13`が通り、当月との比較も文字列の辞書順なので素通りする)。
 */
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: string): boolean => MONTH_KEY_PATTERN.test(value);

/** `Date`から年月を取り出す。「当月」を表す値はすべてここを通す */
export const toMonthKey = (date: Date): string => format(date, MONTH_KEY_FORMAT);

/**
 * 年月をその月の初日の`Date`に直す。
 *
 * **比較にも使う。** `yyyy-MM`は桁が揃っているので文字列のままでも大小を比べられるが、
 * 月をまたぐ計算(年送り・月末の算出)には日付が要る。
 */
export const fromMonthKey = (month: string): Date =>
  parse(`${month}-01`, `${MONTH_KEY_FORMAT}-dd`, new Date());

/** 年月から年だけを取り出す(ピッカーが表示している年の初期値に使う) */
export const yearOfMonthKey = (month: string): number => fromMonthKey(month).getFullYear();

/** 年と月(1〜12)から年月を組み立てる。ピッカーの月グリッドが押されたときの値 */
export const buildMonthKey = (year: number, monthNumber: number): string =>
  `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;

/** カードの見出しに出す表示(例: 2026年8月)。月は0埋めしない — 見出しの数字として読む値のため */
export const formatMonthLabel = (month: string): string => {
  const date = fromMonthKey(month);

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
};
