export {};

declare global {
  /**
   * B4で管理する分類軸(Firestoreの`users/{uid}/categoryAxes/{axisId}`)。
   *
   * `assetTypeNames`が空配列の場合は「すべての資産種別が対象」を意味する(総資産のような
   * 軸を、特別扱いのコードを書かずにユーザーが登録できるようにするため。HTMLモックの
   * 「総資産」行が集計対象を1件も選ばず「すべての口座・資産種別が対象」と表示しているのと対応する)。
   */
  type AssetCategoryAxisDocument = {
    id: string;
    name: string;
    /** 集計対象の資産種別名(B2 CSV取込で実際に取り込まれた種別のみを選択肢にする) */
    assetTypeNames: string[];
    /** 登録日時(ISO 8601)。書き込み直後でサーバー時刻が未確定の間は`null` */
    createdAt: string | null;
  };

  /** 分類軸の追加・編集フォームの入力値 */
  type AssetCategoryAxisFormValues = {
    name: string;
    assetTypeNames: string[];
  };

  /**
   * 分類軸の取得・作成・更新・削除が失敗した理由。
   *
   * B4に固有の失敗は無く、Firestoreへのアクセス自体の失敗と一致する。画面側の文言
   * (`CATEGORY_AXIS_FAILURE_MESSAGES`)がB4の言い回しを持つため、名前だけ分けている。
   */
  type AssetCategoryFailureReason = FirestoreAccessFailureReason;

  /** 分類軸の保存(作成・更新)結果 */
  type SaveCategoryAxisResult = { ok: true } | { ok: false; reason: AssetCategoryFailureReason };

  /** 分類軸の削除結果 */
  type DeleteCategoryAxisResult = { ok: true } | { ok: false; reason: AssetCategoryFailureReason };

  /** 既知の資産種別名の取得結果(B4の集計対象チェックボックスの選択肢) */
  type AssetTypeOptionsResult =
    { ok: true; assetTypeNames: string[] } | { ok: false; reason: AssetCategoryFailureReason };

  /**
   * 集計対象の選択肢の状態。読み込み中・取得失敗・取得済みを1つの値で表す。
   *
   * 件数(空配列)だけでは「まだ読み込んでいない」「取得に失敗した」「CSVを一度も
   * 取り込んでいない」の3つが区別できず、案内の文言と保存の可否がずれる。
   * 空配列に倒した結果が未取込の案内に化けたのがB4-1、読み込み中に保存できてしまう
   * のが残っていたのがB4-2。
   */
  type AssetTypeOptionsState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; assetTypeNames: string[] };

  /** 分類軸の追加・編集フォームのProps */
  type AssetCategoryAxisFormProps = {
    /** 新規追加は空値、編集は対象の分類軸の値を渡す */
    initialValues: AssetCategoryAxisFormValues;
    /** 集計対象チェックボックスの選択肢(既知の資産種別名)と、その取得状態 */
    assetTypeOptions: AssetTypeOptionsState;
    submitLabel: string;
    onSubmit: (values: AssetCategoryAxisFormValues) => Promise<SaveCategoryAxisResult>;
    onCancel: () => void;
  };

  /** 登録済み分類一覧のProps */
  type AssetCategoryAxisListProps = {
    axes: AssetCategoryAxisDocument[];
    onEdit: (axis: AssetCategoryAxisDocument) => void;
    onDelete: (axis: AssetCategoryAxisDocument) => void;
  };

  /** 削除確認・削除禁止ダイアログのProps */
  type DeleteCategoryAxisDialogProps = {
    /** 削除対象。`null`は非表示 */
    axis: AssetCategoryAxisDocument | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: (axis: AssetCategoryAxisDocument) => Promise<DeleteCategoryAxisResult>;
  };
}
