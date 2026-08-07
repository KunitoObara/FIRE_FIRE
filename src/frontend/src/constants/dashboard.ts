/** B1 ダッシュボード画面で使う定数 */

import {
  ASSET_CATEGORIES_PATH,
  CSV_IMPORT_PATH,
  FIRE_GOAL_PATH,
  TRANSACTIONS_PATH,
} from "@/constants/routes";

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

/** ダッシュボードの表示データのキャッシュキー(TanStack Query) */
export const DASHBOARD_DATA_QUERY_KEY = ["dashboard-data"] as const;

/**
 * 表示データを取得できなかったときの文言。
 *
 * 取得に失敗した場合はウィジェットの空状態を出さない。データはあるのに「まだありません」と
 * 読める表示になるのを避けるため、失敗は失敗として出す(B5 不動産一覧と同じ扱い)。
 */
/**
 * 表示データの組み立て自体が例外で落ちたときの文言。
 *
 * Firestoreの取得は理由付きの失敗として返るが、取得後の集計(日付の整形など)は
 * その外側で走るため、壊れた値が1件混じるだけで例外になる。原因はデータ側にあり
 * 再試行では直らないことが多いので、確認先まで添える。
 */
export const DASHBOARD_UNEXPECTED_ERROR_MESSAGE =
  "データを表示できませんでした。再試行しても直らない場合は、取り込んだCSVのデータに問題がある可能性があります。";

/** 取得をやり直すボタンの文言(A7の「再試行する」に合わせる) */
export const DASHBOARD_RETRY_LABEL = "再試行する";

/** 再試行の実行中に見せる文言 */
export const DASHBOARD_RETRYING_LABEL = "再試行中…";

export const DASHBOARD_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};
