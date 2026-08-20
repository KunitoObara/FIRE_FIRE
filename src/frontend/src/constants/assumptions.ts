/** B9 想定利回り・リスク設定画面で使う定数(docs/screen-requirements-fire-goal.md B9) */

import { Circle, Diamond, Triangle } from "lucide-react";

import { CSV_IMPORT_PATH } from "@/constants/routes";

/** 画面上部の説明文。設定値が2つの用途(シミュレーションと可視化)に使われることを先に伝える */
export const ASSUMPTIONS_DESCRIPTION =
  "資産種別ごとの想定利回り・リスクレベルを設定します。設定値はFIRE到達予測の入力パラメータと、ダッシュボードでのリスク可視化の両方に使われます。";

/**
 * 一覧の列見出し(HTMLモック b9-assumption-settings.html の表に合わせる)。
 *
 * 「資産・口座」ではなく「資産種別」。この画面が設定するのはCSVの資産種別ごとの想定値で、
 * 口座単位の残高はマネーフォワードのCSVに含まれないため(docs/screen-requirements-fire-goal.md
 * B9「設定の単位は資産種別」)。旧称は要件・モックが口座単位を想定していた頃の名残で、
 * 要求定義 Ph4 で3者を資産種別へ揃えた。
 */
export const ASSUMPTIONS_ASSET_COLUMN_LABEL = "資産種別";
export const ASSUMPTIONS_BALANCE_COLUMN_LABEL = "現在残高";
export const ASSUMPTIONS_EXPECTED_RETURN_COLUMN_LABEL = "想定利回り(年率%)";
export const ASSUMPTIONS_RISK_LEVEL_COLUMN_LABEL = "リスクレベル";

/**
 * 入力欄1つ分のラベル。列見出しだけでは行が特定できないため、資産種別名を添える。
 *
 * 見出しは列に1つしか無く、行ごとの入力欄は見出しと紐づけられない(表の中に同じ名前の
 * 欄が資産種別の数だけ並ぶ)。支援技術に「どの資産のどの欄か」を伝えるためのもの。
 */
export const buildExpectedReturnFieldLabel = (assetTypeName: string): string =>
  `${assetTypeName}の${ASSUMPTIONS_EXPECTED_RETURN_COLUMN_LABEL}`;
export const buildRiskLevelFieldLabel = (assetTypeName: string): string =>
  `${assetTypeName}の${ASSUMPTIONS_RISK_LEVEL_COLUMN_LABEL}`;

/**
 * リスクレベル未選択を表すセレクトの値。
 *
 * Radixの`SelectItem`は空文字を値に取れないため、`null`(未設定)を画面上で表す値を別に置く。
 * 保存時に`null`へ戻す(`src/lib/assumptions/form-values.ts`)。
 */
export const UNSET_RISK_LEVEL_VALUE = "unset";

/** 未選択の選択肢の表示名。「まだ決めていない」を選び直せるよう、選択肢として残す */
export const UNSET_RISK_LEVEL_LABEL = "未設定";

/**
 * リスクレベルの選択肢。
 *
 * DESIGN.md 3章のとおり、**色だけに頼らず形状(アイコン)と文字を併用する**。色覚特性に
 * よらず区別できるようにするためで、意味を運ぶのは形状と文字の方であり、色は補助に留める。
 *
 * 色は青→橙→赤の3段階(HTMLモックの配色)で、既存のトークン`--chart-1`/`--chart-4`/`--chart-8`
 * をそのまま借りる。DESIGN.md 3章が「DESIGN.md側に重複した色定義を持たせない」としており、
 * ここで新しい色を定義しないため。分類別内訳の色スロットと同じトークンだが、リスクバッジが
 * 出るのはB9の一覧の中だけで、分類色の凡例やグラフと同じ画面には並ばない。
 *
 * `badgeClassName`の不透明度`/10`は、モックの新規パステル背景をそのままトークン化するのではなく
 * 既存の淡色バッジと揃えた値(`components/ui/badge.tsx`のdestructiveバリアント
 * `bg-destructive/10 text-destructive`)。`alert.tsx`のerror/successバリアントは`/8`、
 * infoバリアントは`/6`で、コードベース全体が`/10`に統一されているわけではないが、
 * バッジという同じ部品(`Badge`コンポーネント)の既存バリアントに揃えた。
 */
export const ASSUMPTION_RISK_LEVELS: AssumptionRiskLevelOption[] = [
  { id: "low", label: "低", icon: Circle, badgeClassName: "bg-chart-1/10 text-chart-1" },
  { id: "medium", label: "中", icon: Triangle, badgeClassName: "bg-chart-4/10 text-chart-4" },
  { id: "high", label: "高", icon: Diamond, badgeClassName: "bg-chart-8/10 text-chart-8" },
];

/**
 * 想定利回りで受け付ける形式。小数とマイナスを許す。
 *
 * マイナスを許すのは、元本割れを見込む資産に対して「年率-1%」のような想定を置けるようにするため。
 * カンマ区切り・全角数字・指数表記は受け付けない(B7・B8の数値欄と揃える)。
 */
export const EXPECTED_RETURN_PATTERN = /^-?[0-9]+(?:\.[0-9]+)?$/u;

/**
 * 想定利回りの絶対値の上限(%)。
 *
 * 年率100%を超える想定は、桁の打ち間違い(5を500と打つ等)の方がはるかに起こりやすい。
 * シミュレーションの入力パラメータなので、極端な値がそのまま予測に効いてしまう。
 */
export const EXPECTED_RETURN_ABS_MAX = 100;

/**
 * 保存できる資産種別の件数の上限。`firestore.rules`の`settings/assumptions`の検証と一致させる。
 *
 * 資産種別はCSVの列の顔ぶれで決まるため件数を決め打ちできない。実際には数十件に収まるので、
 * 壊れた書き込みを弾く歯止めとして余裕を持たせた上限を置く。
 */
export const ASSUMPTION_ENTRIES_MAX = 200;

/** 想定利回りの形式エラー(インラインエラー表示) */
export const EXPECTED_RETURN_FORMAT_MESSAGE = "半角数字のみ入力してください。";

/** 想定利回りが範囲外のときのエラー */
export const EXPECTED_RETURN_RANGE_MESSAGE = `想定利回りは-${EXPECTED_RETURN_ABS_MAX}%〜${EXPECTED_RETURN_ABS_MAX}%の範囲で入力してください。`;

/** 「保存」ボタンのラベル */
export const ASSUMPTIONS_SUBMIT_LABEL = "保存";
export const ASSUMPTIONS_SUBMITTING_LABEL = "保存中...";

/** 保存完了のトースト(DESIGN.md 3章のsonner) */
export const ASSUMPTIONS_SAVED_MESSAGE = "想定利回り・リスクを保存しました";

/**
 * 資産残高が1件も無いときの空状態。
 *
 * 一覧の行は取り込んだ資産残高の資産種別から作るため、CSVが未取込だと設定する対象が無い。
 * 「データがありません」で止めず、B2への導線を添える(`DashboardEmptyState`の方針)。
 */
export const NO_ASSET_BALANCES_EMPTY_STATE = {
  message: "資産残高がまだ取り込まれていません。CSVを取り込むと、資産種別ごとに設定できます。",
  action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
} as const;

/** 取得・保存が失敗したときの文言(`FIRE_GOAL_FAILURE_MESSAGES`と同じ考え方) */
export const ASSUMPTIONS_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/** 想定利回り・リスク設定のキャッシュキー(TanStack Query) */
export const ASSUMPTIONS_QUERY_KEY = ["assumptions"] as const;

/** 資産種別ごとの現在残高のキャッシュキー(TanStack Query) */
export const LATEST_ASSET_BALANCES_QUERY_KEY = ["latest-asset-balances"] as const;
