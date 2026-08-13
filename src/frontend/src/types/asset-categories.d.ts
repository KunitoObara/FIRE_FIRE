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
    /**
     * 集計に加える物件と、その反映方法(B5〜B7で登録した物件。B4「集計対象に不動産を含める」)。
     *
     * キーが物件ID、値が**その物件をどちらの額で反映するか**。資産種別・負債と**別のフィールド**で
     * 持つのは、物件がIDを持つうえに反映方法を1件ごとに添える必要があり、名前の配列
     * (`assetTypeNames`)にもIDだけの配列(`debtIds`)にも混ぜられないため。
     *
     * `debtIds`と同じく、**空のマップは「不動産を反映しない」を意味する**。「未選択=すべて」の
     * 読み替えは資産種別にだけ適用する — 適用すると、物件の選択を持たない既存の分類軸が、
     * 物件の登録と同時に黙って不動産を含む軸へ変わる。
     */
    propertyValuations: CategoryAxisPropertyValuations;
    /** 登録日時(ISO 8601)。書き込み直後でサーバー時刻が未確定の間は`null` */
    createdAt: string | null;
  };

  /**
   * 物件をダッシュボードへ反映するときの額の取り方(B4の「利ざやのみ反映」チェックボックス)。
   *
   * - `spread` — 利ざや(時価 - ローン残高)。チェックあり
   * - `marketValue` — 時価。チェックなし
   *
   * 居住用は取り崩せないので利ざやで見たいが投資用は時価で見たい、のように見方が物件ごとに
   * 変わるため、軸に1つの設定にせず物件ごとに持つ(B4)。
   */
  type RealEstateValuationMode = "spread" | "marketValue";

  /** 物件IDごとの反映方法。キーを持たない物件はその分類軸の集計に入らない */
  type CategoryAxisPropertyValuations = Record<string, RealEstateValuationMode>;

  /** 分類軸の追加・編集フォームの入力値 */
  type AssetCategoryAxisFormValues = {
    name: string;
    assetTypeNames: string[];
    debtIds: string[];
    propertyValuations: CategoryAxisPropertyValuations;
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

  /**
   * 分類軸が参照している負債の内訳(B11で削除された参照を見分ける)。
   *
   * 件数だけでなく残っているIDも持つのは、一覧の件数表示と編集フォームの初期値が
   * **同じ判定**から出るようにするため。別々に絞り込むと、一覧が「負債 1件」と出して
   * いるのにフォームには2件チェックが入る、のようなずれが起こりうる。
   */
  type CategoryAxisDebtReferences = {
    /** 実際に集計から差し引かれる負債のID(B11に残っているもの) */
    activeIds: string[];
    /** B11で削除されていて集計対象にならない参照の件数 */
    missingCount: number;
  };

  /**
   * 物件の選択肢の状態。読み込み中・取得失敗・取得済みを1つの値で表す。
   *
   * `DebtOptionsState`と同じ理由・同じ形。選択肢が出ないまま保存すると、選択済みの物件が
   * 黙って外れた分類軸で上書きされるため、取得できるまで保存を止める(B4)。
   */
  type PropertyOptionsState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; properties: RealEstateProperty[] };

  /**
   * 分類軸が参照している物件の内訳(B6で削除された参照を見分ける)。
   *
   * 負債の`CategoryAxisDebtReferences`と同じ役割だが、**残すのはIDではなく反映方法まで含んだ
   * マップ**。フォームの初期値がそのまま「どの物件をどちらの額で反映するか」であり、IDだけを
   * 返すと呼び出し側で反映方法を引き直すことになるため。
   */
  type CategoryAxisPropertyReferences = {
    /** 実際に集計へ加わる物件と反映方法(B5〜B7に残っているもの) */
    activeValuations: CategoryAxisPropertyValuations;
    /** 削除されていて集計対象にならない参照の件数 */
    missingCount: number;
  };

  /** 分類軸の追加・編集フォームのProps */
  type AssetCategoryAxisFormProps = {
    /** 新規追加は空値、編集は対象の分類軸の値を渡す */
    initialValues: AssetCategoryAxisFormValues;
    /** 集計対象チェックボックスの選択肢(既知の資産種別名)と、その取得状態 */
    assetTypeOptions: AssetTypeOptionsState;
    /** 集計対象に含める負債の選択肢(B11で登録済みの負債)と、その取得状態 */
    debtOptions: DebtOptionsState;
    /**
     * `initialValues`から落とした、B11で削除済みの負債への参照の件数。
     *
     * 落としたこと自体を負債の選択欄に出すために要る(B4)。フォーム側で数え直せないのは、
     * `initialValues.debtIds`が既に絞り込み後の値だから。新規追加では常に`0`。
     */
    missingDebtCount: number;
    /** 集計対象に加える物件の選択肢(B5〜B7で登録済みの物件)と、その取得状態 */
    propertyOptions: PropertyOptionsState;
    /**
     * `initialValues`から落とした、削除済みの物件への参照の件数。
     *
     * 負債の`missingDebtCount`と同じ理由で呼び出し側から渡す
     * (`initialValues.propertyValuations`は既に絞り込み後の値なので、フォーム側で数え直せない)。
     */
    missingPropertyCount: number;
    submitLabel: string;
    onSubmit: (values: AssetCategoryAxisFormValues) => Promise<SaveCategoryAxisResult>;
    onCancel: () => void;
  };

  /** 登録済み分類一覧のProps */
  type AssetCategoryAxisListProps = {
    axes: AssetCategoryAxisDocument[];
    /**
     * 負債の選択肢と取得状態。一覧そのものには要らないが、**紐付け状況の件数を
     * 実際に差し引かれる負債の数で出す**ために要る(B4)。参照の数をそのまま出すと、
     * 一覧の件数とB1で差し引かれている額が食い違う。
     */
    debtOptions: DebtOptionsState;
    /** 物件の選択肢と取得状態。件数を実際に集計へ加わる物件の数で出すために要る(負債と同じ) */
    propertyOptions: PropertyOptionsState;
    onEdit: (axis: AssetCategoryAxisDocument) => void;
    onDelete: (axis: AssetCategoryAxisDocument) => void;
  };

  /** 削除確認・削除禁止ダイアログのProps */
  type DeleteCategoryAxisDialogProps = {
    /** 削除対象。`null`は非表示 */
    axis: AssetCategoryAxisDocument | null;
    /**
     * 登録済みの負債。削除可否を「参照の件数」ではなく「実際に集計対象になっている件数」で
     * 判定するために要る(B4-3)。読み込み中・取得失敗のあいだは判定できない
     */
    debtOptions: DebtOptionsState;
    /** 登録済みの物件。負債と同じ理由で、削除可否を実際に集計対象になっている件数で判定する */
    propertyOptions: PropertyOptionsState;
    onOpenChange: (open: boolean) => void;
    onConfirm: (axis: AssetCategoryAxisDocument) => Promise<DeleteCategoryAxisResult>;
  };
}
