/** B4 資産分類マスタ設定画面で使う定数(docs/screen-requirements-dashboard.md B4) */

import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";

/** 分類名の最大文字数。firestore.rulesの`categoryAxes`の検証と一致させる */
export const CATEGORY_AXIS_NAME_MAX_LENGTH = 40;

/**
 * 集計対象を読み込む対象範囲の上限(assetSnapshotsの走査件数)。
 * 資産残高は1日1行なので、10年分でもこの件数には収まる
 * (src/constants/csv-import.ts の`MAX_ASSET_BALANCE_ROWS`と同じ考え方)。
 *
 * 値は`FIRESTORE_QUERY_LIMIT_MAX`(Firestoreが`limit()`に許す最大値)そのもの。
 * **これより大きい値は置けない。** 超えるとクエリが`invalid-argument`で拒否され、
 * 選択肢が1件も出せなくなる(B1-3)。CSVを取り込んでいないアカウントと区別が付かない
 * 空の選択肢になるため、取り込み済みでも集計対象を選べない状態になる。
 */
export const ASSET_TYPE_SCAN_LIMIT = FIRESTORE_QUERY_LIMIT_MAX;

/** 一覧に出す集計対象の名前の表示件数。超過分は「ほかN件」にまとめる */
export const CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT = 2;

/** 集計対象を1件も選ばなかったときの表示(総資産のような軸を想定) */
export const CATEGORY_AXIS_ALL_TYPES_LABEL = "すべての資産種別が対象";

/**
 * 集計対象の2グループの見出し(B4「集計対象に負債を含める」)。
 *
 * 資産種別と負債を同じ一覧に混ぜず、グループを分けて出す。同じ配列に混ぜると
 * 識別子の性質が違う2つ(名前 / ID)が並ぶことになり、選択の意味も逆になる。
 */
export const CATEGORY_AXIS_ASSET_TYPE_GROUP_LABEL = "資産種別(複数選択可)";
export const CATEGORY_AXIS_DEBT_GROUP_LABEL = "負債(複数選択可)";

/**
 * 未選択時の意味を各グループに添える文言。
 *
 * 資産種別は「未選択=すべて」、負債は「未選択=差し引かない」で**読み替えが非対称**。
 * 分かりにくいので画面上に明示するのが要件そのもの(B4)。両方を「未選択=すべて」に
 * しないのは、負債の選択を持たない既存の分類軸が、負債の登録と同時に黙って
 * 純資産の軸へ変わってしまうため。
 */
export const CATEGORY_AXIS_ALL_TYPES_HINT = CATEGORY_AXIS_ALL_TYPES_LABEL;
export const CATEGORY_AXIS_NO_DEBT_HINT = "負債は差し引かない";

/** 選択できる負債がまだ無いときの案内(B11で1件も登録していない状態) */
export const NO_DEBT_OPTIONS_NOTICE =
  "集計対象にできる負債がまだありません。負債入力画面で登録すると選択できるようになります。";

/** 負債の選択肢を読み込んでいるあいだの表示 */
export const DEBT_OPTIONS_LOADING_LABEL = "負債の選択肢を読み込んでいます...";

/**
 * 負債の選択肢を取得できないあいだ、保存を止めていることの説明。
 *
 * 選択肢が出せないまま保存すると、選択済みの負債が黙って外れた分類軸で上書きされる
 * (集計対象を選べないまま保存できてしまったのがB4-1・B4-2で、同じ落とし穴)。
 */
export const DEBT_OPTIONS_UNAVAILABLE_NOTICE =
  "負債の選択が読み込めないまま保存すると、選択済みの負債が集計対象から外れるため、選択肢を読み込めるまで保存できません。";

/**
 * 一覧の紐付け状況に添える負債の件数(B4)。
 *
 * **負債を含む軸にだけ出す。** 含まない軸に「負債なし」と書き添えると、大半の軸に
 * 同じ但し書きが並ぶだけになる。負債を含む軸かどうかが一覧で分からないと、
 * B1で値が資産合計と違う理由が追えない。
 */
export const buildCategoryAxisDebtCountLabel = (count: number): string => `負債 ${count}件`;

/** 集計対象の選択肢がまだ無いときの案内(CSVを一度も取り込んでいない状態) */
export const NO_ASSET_TYPE_OPTIONS_NOTICE =
  "集計対象にできる資産種別がまだありません。CSVを取り込むと選択できるようになります。";

/** 登録済み分類が1件も無いときの案内 */
export const NO_CATEGORY_AXES_LABEL =
  "分類軸がまだ登録されていません。「新規分類を追加」から登録してください。";

/** 分類名が未入力のときのエラー */
export const CATEGORY_AXIS_NAME_REQUIRED_MESSAGE = "分類名を入力してください。";

/** 分類名が長すぎるときのエラー */
export const CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE = `分類名は${CATEGORY_AXIS_NAME_MAX_LENGTH}文字以内で入力してください。`;

/**
 * 削除禁止時のダイアログの本文(モックの文言に合わせる)。
 *
 * 負債だけが紐づいている分類も同じく削除できない。集計対象が割り当てられた分類軸を
 * 消させないという制約を資産・負債で分ける理由が無いため(B4の遷移条件)。
 */
export const DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE =
  "この分類には集計対象(資産種別・負債)が紐づいているため、削除できません。先に編集で割り当てを解除してください。";

/** 削除確認ダイアログの本文 */
export const buildDeleteCategoryAxisConfirmMessage = (name: string): string =>
  `分類「${name}」を削除します。この操作は取り消せません。`;

/**
 * 分類軸一覧・集計対象の選択肢を**取得**できなかったときの文言。
 *
 * 保存・削除の失敗(`CATEGORY_AXIS_FAILURE_MESSAGES`)とは別に持つ。表示できないことと
 * 操作できないことでは次にすべきことが違い、「操作に失敗しました」では読めないため。
 * 取得の失敗を空状態(未取込・未登録)として見せないのがこの文言の目的(B1・B5と同じ扱い)。
 */
export const CATEGORY_AXIS_LOAD_FAILURE_MESSAGES: Record<AssetCategoryFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

/** 集計対象の選択肢を読み込んでいるあいだの表示(A7の「リンクを確認しています...」と同じ扱い) */
export const ASSET_TYPE_OPTIONS_LOADING_LABEL = "集計対象の選択肢を読み込んでいます...";

/**
 * 集計対象の選択肢を取得できないあいだ、保存を止めていることの説明。
 *
 * 選択肢が出せないまま保存すると、集計対象を1件も選べず「すべての資産種別が対象」の
 * 分類軸ができてしまう(B1-3で実際に起きた)。意図しない軸を作らせない。
 */
export const ASSET_TYPE_OPTIONS_UNAVAILABLE_NOTICE =
  "集計対象を選べないまま保存すると、すべての資産種別が対象の分類軸になるため、選択肢を読み込めるまで保存できません。";

/** 分類軸の取得・保存・削除が失敗したときの文言 */
export const CATEGORY_AXIS_FAILURE_MESSAGES: Record<AssetCategoryFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/** 分類軸一覧のキャッシュキー(TanStack Query) */
export const CATEGORY_AXES_QUERY_KEY = ["category-axes"] as const;

/** 集計対象の選択肢(既知の資産種別名)のキャッシュキー(TanStack Query) */
export const ASSET_TYPE_OPTIONS_QUERY_KEY = ["asset-type-options"] as const;
