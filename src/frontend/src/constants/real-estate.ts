/** B5 不動産一覧画面で使う定数 */

import { REAL_ESTATE_NEW_PATH } from "@/constants/routes";

/**
 * サンプルデータを表示するかどうか。
 *
 * 物件を登録する画面(B7)がまだ無く、Firestoreに物件データが存在しないため、画面の見た目を
 * 確認できるようサンプルデータを流し込んでいる(`src/constants/transactions.ts`の
 * `USE_SAMPLE_TRANSACTIONS_DATA`と同じ考え方)。B7が実装されたら`false`にして
 * `src/lib/real-estate/sample-data.ts`ごと外す。
 *
 * `false`にすると一覧が空状態(B7への導線)になる。
 */
export const USE_SAMPLE_REAL_ESTATE_DATA = true;

/** サンプルデータ表示中であることを画面に明示する文言。実データと取り違えないためのもの */
export const SAMPLE_REAL_ESTATE_DATA_NOTICE =
  "表示中の物件はすべてサンプルです。不動産の登録(B7)実装後に実データへ切り替わります。";

/**
 * 画面上部の説明文。
 *
 * 利ざや(時価-ローン残高)は一覧に出さずB6でのみ表示するのが要件
 * (docs/screen-requirements-real-estate.md B5)なので、どこで見られるかをここで示す。
 */
export const REAL_ESTATE_LIST_DESCRIPTION =
  "登録済みの物件の時価とローン残高を一覧します。利ざやは物件を選ぶと詳細画面で確認できます。";

/** 「新規登録」ボタン(B7の新規登録モードへの導線) */
export const REAL_ESTATE_NEW_LINK = {
  label: "新規登録",
  href: REAL_ESTATE_NEW_PATH,
} as const;

/**
 * 物件が1件も登録されていないときの案内。
 *
 * 導線のラベルは画面上部の「新規登録」ボタンとあえて変える。同じ文言のボタンが縦に2つ並ぶと
 * 別の操作があるように見えるため。
 */
export const NO_REAL_ESTATE_EMPTY_STATE = {
  message: "登録済みの物件がまだありません。",
  action: { label: "物件を登録する", href: REAL_ESTATE_NEW_PATH },
} as const;

/** 一覧の各行に添える金額の見出し */
export const REAL_ESTATE_MARKET_VALUE_LABEL = "時価";
export const REAL_ESTATE_LOAN_BALANCE_LABEL = "ローン残高";
