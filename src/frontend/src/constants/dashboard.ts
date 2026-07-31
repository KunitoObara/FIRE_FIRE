/** B1 ダッシュボード画面で使う定数 */

import {
  ASSET_CATEGORIES_PATH,
  CSV_IMPORT_PATH,
  FIRE_GOAL_PATH,
  TRANSACTIONS_PATH,
} from "@/constants/routes";

/**
 * サンプルデータを表示するかどうか。
 *
 * B2 CSV取込・B4 資産分類マスタ・B8 FIRE目標がまだ無く、Firestoreに実データが存在しないため、
 * 画面の見た目を確認できるようサンプルデータを流し込んでいる。データの繋ぎ込みが済んだら
 * `false`にして`src/lib/dashboard/sample-data.ts`ごと外す。
 *
 * `false`にすると全ウィジェットが空状態(取込・設定への導線)になる。
 */
export const USE_SAMPLE_DASHBOARD_DATA = true;

/** サンプルデータ表示中であることを画面に明示する文言。実データと取り違えないためのもの */
export const SAMPLE_DASHBOARD_DATA_NOTICE =
  "表示中の数値はすべてサンプルです。CSV取込(B2)の実装後に実データへ切り替わります。";

/** 表示期間切替の選択肢(docs/screen-requirements-dashboard.md B1) */
export const DASHBOARD_PERIODS: DashboardPeriod[] = [
  { id: "1y", label: "1年", years: 1 },
  { id: "3y", label: "3年", years: 3 },
  { id: "5y", label: "5年", years: 5 },
  { id: "all", label: "全期間", years: null },
];

/** 表示期間の既定値 */
export const DEFAULT_DASHBOARD_PERIOD_ID: DashboardPeriodId = "1y";

/**
 * 分類軸・表示期間をURLに載せるときのクエリパラメータ名。
 * リンク共有・ブラウザの戻る/進むで同じ表示を再現するため、これらはURLに持たせる
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
export const DASHBOARD_AXIS_PARAM = "axis";
export const DASHBOARD_PERIOD_PARAM = "period";

/**
 * 分類別内訳で個別の色を割り当てられる分類の数。
 * `globals.css`の`--chart-1`〜`--chart-8`と一致させる。
 */
export const CATEGORY_COLOR_SLOT_COUNT = 8;

/** 色のスロットに収まらなかった分類をまとめる表示名 */
export const OTHER_CATEGORY_NAME = "その他";

/** 色のスロットに収まらなかった分類をまとめる際の擬似的な分類ID */
export const OTHER_CATEGORY_ID = "__other__";

/** 直近CSV取込日時が無いときの表示 */
export const NO_CSV_IMPORT_LABEL = "CSV未取込";

/** 各ウィジェットの空状態(docs/screen-requirements-dashboard.md B1の各表示項目に対応) */
export const DASHBOARD_EMPTY_STATES = {
  netWorth: {
    message: "資産残高のデータがまだありません。CSVを取り込むと推移が表示されます。",
    action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
  },
  breakdown: {
    message: "この分類軸に集計対象の資産がありません。分類の設定を確認してください。",
    action: { label: "資産分類を設定する", href: ASSET_CATEGORIES_PATH },
  },
  fireProgress: {
    message: "FIRE目標が未設定です。目標を設定すると達成度と到達予測日が表示されます。",
    action: { label: "目標を設定する", href: FIRE_GOAL_PATH },
  },
  cashflow: {
    message: "入出金明細のデータがまだありません。CSVを取り込むと当月の収支が表示されます。",
    action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
  },
} as const;

/** 分類軸が1つも登録されていないときの案内 */
export const NO_ASSET_AXIS_EMPTY_STATE = {
  message: "分類軸が登録されていません。資産分類マスタで分類軸を追加してください。",
  action: { label: "資産分類を設定する", href: ASSET_CATEGORIES_PATH },
} as const;

/** 収支サマリから収支明細一覧(B3)への導線 */
export const CASHFLOW_DETAIL_LINK = { label: "詳細を見る", href: TRANSACTIONS_PATH } as const;

/** FIRE達成度ゲージからFIRE目標設定(B8)への導線 */
export const FIRE_GOAL_LINK = { label: "目標を設定する", href: FIRE_GOAL_PATH } as const;

/** 「CSVを取り込む」ボタンの導線 */
export const CSV_IMPORT_LINK = { label: "CSVを取り込む", href: CSV_IMPORT_PATH } as const;

/** 到達予測日が算出できていないときの表示 */
export const NO_PROJECTED_DATE_LABEL = "算出できません";
