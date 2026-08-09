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
    /**
     * 集計から差し引く負債のID(B11で登録した負債。B4「集計対象に負債を含める」)。
     *
     * 資産種別と**別のフィールド**で持つ。資産種別はCSVの列名(名前)が唯一の識別子だが、
     * 負債はIDを持ち同じ名前の負債を複数登録できるため、同じ配列に混ぜると区別できない。
     *
     * `assetTypeNames`と違い、**空配列は「負債を差し引かない」を意味する**。
     * 「未選択=すべて」の読み替えは資産種別にだけ適用する — 両方に適用すると、
     * 負債の選択を持たない既存の分類軸が、負債の登録と同時に黙って純資産の軸へ変わる。
     */
    debtIds: string[];
    /** 登録日時(ISO 8601)。書き込み直後でサーバー時刻が未確定の間は`null` */
    createdAt: string | null;
  };

  /** 分類軸の追加・編集フォームの入力値 */
  type AssetCategoryAxisFormValues = {
    name: string;
    assetTypeNames: string[];
    debtIds: string[];
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

  /**
   * 負債の選択肢の状態。読み込み中・取得失敗・取得済みを1つの値で表す。
   *
   * `AssetTypeOptionsState`と同じ理由で3つを型で分ける。空配列に倒すと「まだ読み込んで
   * いない」「取得に失敗した」「負債を1件も登録していない」の区別が付かず、案内の文言と
   * 保存の可否がずれる。負債では実害がさらに大きく、選択肢が出ないまま保存すると
   * 選択済みの負債が黙って外れた分類軸で上書きされる。
   */
  type DebtOptionsState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; debts: Debt[] };

  /** 分類軸の追加・編集フォームのProps */
  type AssetCategoryAxisFormProps = {
    /** 新規追加は空値、編集は対象の分類軸の値を渡す */
    initialValues: AssetCategoryAxisFormValues;
    /** 集計対象チェックボックスの選択肢(既知の資産種別名)と、その取得状態 */
    assetTypeOptions: AssetTypeOptionsState;
    /** 集計対象に含める負債の選択肢(B11で登録済みの負債)と、その取得状態 */
    debtOptions: DebtOptionsState;
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
