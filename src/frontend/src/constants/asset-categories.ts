/** B4 資産分類マスタ設定画面で使う定数(docs/screen-requirements-dashboard.md B4) */

/** 分類名の最大文字数。firestore.rulesの`categoryAxes`の検証と一致させる */
export const CATEGORY_AXIS_NAME_MAX_LENGTH = 40;

/**
 * 集計対象を読み込む対象範囲の上限(assetSnapshotsの走査件数)。
 * 資産残高は1日1行なので、10年分でもこの件数には収まる
 * (src/constants/csv-import.ts の`MAX_ASSET_BALANCE_ROWS`と同じ考え方)。
 */
export const ASSET_TYPE_SCAN_LIMIT = 20_000;

/** 一覧に出す集計対象の名前の表示件数。超過分は「ほかN件」にまとめる */
export const CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT = 2;

/** 集計対象を1件も選ばなかったときの表示(総資産のような軸を想定) */
export const CATEGORY_AXIS_ALL_TYPES_LABEL = "すべての資産種別が対象";

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

/** 削除禁止時のダイアログの本文(モックの文言に合わせる) */
export const DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE =
  "この分類には既存の資産データが紐づいているため、削除できません。先に紐づく資産種別の割り当てを解除してください。";

/** 削除確認ダイアログの本文 */
export const buildDeleteCategoryAxisConfirmMessage = (name: string): string =>
  `分類「${name}」を削除します。この操作は取り消せません。`;

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
