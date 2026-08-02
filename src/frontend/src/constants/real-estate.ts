/** B5 不動産一覧画面・B6 不動産詳細画面で使う定数 */

import { REAL_ESTATE_NEW_PATH, REAL_ESTATE_PATH } from "@/constants/routes";

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

/** 一覧の各行・詳細に添える金額の見出し */
export const REAL_ESTATE_MARKET_VALUE_LABEL = "時価";
export const REAL_ESTATE_LOAN_BALANCE_LABEL = "ローン残高";

/**
 * 利ざやの見出し(B6)。
 *
 * 「(自動計算)」を添えるのは、手で入力した値ではなく時価とローン残高から導いた値だと
 * 画面上で分かるようにするため(docs/screen-requirements-real-estate.md B6の表示項目)。
 */
export const REAL_ESTATE_SPREAD_LABEL = "利ざや(自動計算)";

/** 利ざやの計算式。見出しだけでは何から引いた値か伝わらないため添える */
export const REAL_ESTATE_SPREAD_DESCRIPTION = "時価 - ローン残高";

/** 賃貸収支セクション(収益物件のみ表示)の見出しと各項目 */
export const REAL_ESTATE_RENTAL_SECTION_TITLE = "賃貸収支(月額)";
export const REAL_ESTATE_RENTAL_INCOME_LABEL = "賃貸収入";
export const REAL_ESTATE_RENTAL_EXPENSE_LABEL = "賃貸支出";
export const REAL_ESTATE_RENTAL_BALANCE_LABEL = "収支";

/** 物件基本情報セクションの見出しと各項目 */
export const REAL_ESTATE_BASIC_INFO_SECTION_TITLE = "物件基本情報";
export const REAL_ESTATE_NAME_LABEL = "物件名";
export const REAL_ESTATE_LOCATION_LABEL = "所在地";
export const REAL_ESTATE_UPDATED_AT_LABEL = "最終更新日";

/** 収益物件であることを物件名の下に示すラベル。非収益物件には何も出さない */
export const REAL_ESTATE_RENTAL_PROPERTY_LABEL = "収益物件";

/** 「一覧に戻る」リンク(B5へ戻る) */
export const REAL_ESTATE_BACK_TO_LIST_LINK = {
  label: "一覧に戻る",
  href: REAL_ESTATE_PATH,
} as const;

/** 「編集」ボタンのラベル。遷移先は物件IDから組み立てるためここには持たない */
export const REAL_ESTATE_EDIT_LABEL = "編集";

/**
 * 指定された物件が見つからないときの案内(B6の`not-found.tsx`)。
 *
 * 削除済みの物件をブックマークや履歴から開いた場合に出る。行き止まりにしないよう
 * 一覧への導線を添える。
 */
export const REAL_ESTATE_NOT_FOUND = {
  title: "物件が見つかりません",
  message: "指定された物件は削除されたか、URLが正しくない可能性があります。",
  action: REAL_ESTATE_BACK_TO_LIST_LINK,
} as const;
