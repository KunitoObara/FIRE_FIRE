/** B1 ダッシュボード画面で使う定数 */

import {
  ASSET_CATEGORIES_PATH,
  CSV_IMPORT_PATH,
  DEBTS_PATH,
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

/**
 * 分類別内訳の負債スライスを表す擬似的な分類ID(`OTHER_CATEGORY_ID`と同じ考え方)。
 *
 * **表示名「負債」との一致で判定しない。** 資産種別の名前はCSVの列名そのもの
 * (要件定義書 4.3)なので「負債」という名前の資産種別が現れうるし、名前による分岐は
 * 分類軸をハードコードしない方針にも反する(docs/screen-requirements-dashboard.md B1)。
 */
export const DEBT_CATEGORY_ID = "__debt__";

/** 分類別内訳の負債スライスの表示名。項目ごとに分けず1つにまとめる(項目別はB1の負債サマリとB11で見る) */
export const DEBT_CATEGORY_NAME = "負債";

/**
 * 負債スライスの色。**資産分類カラーのスロット(`--chart-1`〜`--chart-8`)を使わない**
 * (DESIGN.md 3章)。
 *
 * 負債がスロットを1つ占めると、実際に保有している資産の分類が「その他」へ押し出される。
 * 負債は分類軸ごとに1スライスに固定なので、スロットを配る対象にする必要がない。
 * 赤(`--destructive`)を当てるのは、負の値を赤で表す会計上の慣用に沿うため。
 */
export const DEBT_CATEGORY_COLOR = "var(--destructive)";

/**
 * 負債のスライスに重ねるハッチング(斜線)。**隣り合うスライスの色相にかかわらず常に重ねる**
 * (DESIGN.md 3章)。
 *
 * 負債は最後のスライスなので円グラフでは12時の位置で1色目と必ず隣り合うが、そこに何色が
 * 来るかは分類軸ごとの登録順で決まり、`--chart-*`の値も後から調整されうる。「今のパレットでは
 * 色相が離れているから不要」という判断にすると、パレットを触ったときに見分けにくい
 * 組み合わせが黙って生まれる。色以外の手がかりを併用する方針はリスクレベル(B9)と同じ。
 *
 * 円グラフ側はSVGの`<pattern>`で描くため、参照するIDをここで固定する。
 */
export const DEBT_SLICE_HATCH_PATTERN_ID = "category-breakdown-debt-hatch";

/**
 * 凡例の色見本に重ねるハッチング。円グラフのスライスと同じ見た目にする
 * (見本とスライスの見た目が違うと対応が取れない。DESIGN.md 3章)。
 *
 * SVGの`<pattern>`はグラフのSVGの中にしか無いので、凡例はCSSのグラデーションで同じ
 * 斜線を作る。角度と間隔を`DEBT_SLICE_HATCH_*`と揃えてある。
 */
export const DEBT_LEGEND_SWATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, var(--destructive) 0 2px, color-mix(in oklab, var(--destructive) 55%, white) 2px 4px)";

/**
 * 差引後の純額に添える見出し(分類別内訳のカード)。
 *
 * 円グラフは正の面積でしか比を表せず、負債のスライスを置いた時点で**構成比の分母は
 * 「対象の資産合計 + 対象の負債合計」**になる。%が純資産に対する割合ではないことが
 * 分かるよう、差引後の純額を数字で併記する(docs/screen-requirements-dashboard.md B1)。
 */
export const BREAKDOWN_NET_AMOUNT_LABEL = "資産 - 負債";

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

/**
 * 負債サマリに並べる項目の件数。超過分は「ほかN件」にまとめてB11へ渡す
 * (docs/screen-requirements-dashboard.md B1「負債サマリ」)。
 * ダッシュボードのカードは俯瞰のための場所で、全件を並べる場所ではB11がある。
 */
export const DEBT_SUMMARY_ROW_LIMIT = 5;

/**
 * 負債が1件も登録されていないときの案内。負債が無いこと自体はエラーではない。
 *
 * 導線のラベルはカード見出しの「負債を入力する」とあえて変える。同じ文言のリンクが
 * 縦に2つ並ぶと別の操作があるように見えるため(B5の空状態と同じ扱い)。
 */
export const DEBT_SUMMARY_EMPTY_STATE = {
  message: "負債がまだ登録されていません。登録するとここに残債が並びます。",
  action: { label: "負債を登録する", href: DEBTS_PATH },
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

/**
 * 達成度の対象分類(B8)に設定していた分類軸がB4で削除されていたときの注意書き。
 *
 * 既定(総資産)で計算したうえでこれを出す。ゲージを消したり達成率0%にしたりはしない
 * (docs/screen-requirements-dashboard.md B1)。設定し直す先はB8なので、カードに元から
 * ある`FIRE_GOAL_LINK`がそのまま導線になる。
 */
export const ACHIEVEMENT_AXIS_MISSING_NOTICE =
  "設定していた対象分類が見つからないため、総資産で計算しています。";

/**
 * 現在資産額がマイナス(負債が資産を上回る)のときにゲージのカードへ添える注記。
 *
 * 達成率は0%に丸めるが、0%は「まだ何も貯まっていない」状態でも出る値なので、
 * 注記が無いと両者を区別できない(docs/screen-requirements-dashboard.md B1)。
 * 現在資産額そのものはマイナスのまま出すので、金額と読み合わせられる。
 */
export const NEGATIVE_CURRENT_AMOUNT_NOTICE =
  "対象分類の負債が資産を上回っているため、達成率は0%として表示しています。";

/** 到達予測日が算出できていないときの表示 */
export const NO_PROJECTED_DATE_LABEL = "算出できません";

/**
 * グラフの登場アニメーションの再生時間(ms)と、その進み方(DESIGN.md 9章)。
 *
 * ログイン直後の最初の画面なので、資産状況の把握を待たせない長さに収める。
 * 3つのグラフで同じ値を使う。グラフごとに違う長さだと、同じ画面の中で別々に動いて見える。
 */
export const CHART_ANIMATION_DURATION_MS = 600;
export const CHART_ANIMATION_EASING = "ease-out";

/**
 * 資産推移グラフ・分類別内訳の再生の引き金にする、データの署名。
 *
 * 再生するのは**そのグラフ自身のデータが変わったとき**だけで、ホバー・リサイズ・
 * 同じデータのままの再レンダリングでは再生しない(DESIGN.md 9章)。この署名を
 * Reactの`key`に渡してコンポーネントを作り直すことで、その条件をそのまま表す。
 *
 * 配列の同一性(参照)では判定できない。表示データは取得のたびに組み立て直されるため、
 * 中身が同じでも参照は毎回変わり、再取得だけで再生してしまう。
 *
 * **全点を署名に含める。** 件数と両端だけでは、CSVを取り込み直して途中の月の残高だけが
 * 訂正された場合(件数も両端も変わらない)に線の形が変わったことを検出できず、再生が漏れる。
 * 点は月に1つで「全期間」でも数十個にしかならないため、全点を並べても負担にならない。
 *
 * **区切り文字での連結ではなく`JSON.stringify`で組む。** 分類軸名(B4でユーザーが付ける)や
 * 資産種別名(CSVの列名)は自由入力に近く、区切りに使った文字がそのまま値に現れうる。
 * 連結だと、中身の違う2つのデータが同じ署名に潰れて再生が漏れる。
 */
export const buildNetWorthSeriesKey = (axisName: string, series: NetWorthPoint[]): string =>
  JSON.stringify([axisName, series.map((point) => [point.date, point.amount])]);

/**
 * FIRE達成度ゲージの再生の引き金。**固定値**で、初回描画時にしか再生しない(DESIGN.md 9章)。
 *
 * 資産推移・分類別内訳と違い、ゲージは「そのグラフのデータが変わったとき」でも再生しない。
 * 9章の再生条件の表が「初回描画時のみ。分類軸切替・表示期間切替では再生しない」と、他の2つの
 * 一般条件とは書き分けているため。達成率を引き金にすると、画面を開いたまま裏で取り直しが
 * 走って値が変わったとき(別タブでCSVを取り込み直した場合など)にもリングが0%から再生される。
 */
export const FIRE_GAUGE_ANIMATION_KEY = "fire-progress-gauge";

/** 分類別内訳の再生の引き金にする署名(`buildNetWorthSeriesKey`と同じ考え方) */
export const buildBreakdownKey = (axisName: string, slices: AssetBreakdownSlice[]): string =>
  JSON.stringify([axisName, slices.map((slice) => [slice.categoryId, slice.amount])]);

/** ダッシュボードの表示データのキャッシュキー(TanStack Query) */
export const DASHBOARD_DATA_QUERY_KEY = ["dashboard-data"] as const;

/**
 * 表示データを取得できなかったときの文言。
 *
 * 取得に失敗した場合はウィジェットの空状態を出さない。データはあるのに「まだありません」と
 * 読める表示になるのを避けるため、失敗は失敗として出す(B5 不動産一覧と同じ扱い)。
 */
export const DASHBOARD_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

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
