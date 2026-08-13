import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

import type { realEstateFormSchema } from "@/schemas/real-estate";

declare global {
  /**
   * 収益物件の賃貸収支(要件定義書 4.5「賃貸収入/支出(収益物件に対応する場合)」)。
   *
   * 単位は月額に固定する。要件定義書に期間の指定は無いが、家賃・管理費とも月単位で
   * 発生する値であり、HTMLモック(b6-real-estate-detail.html)も「賃貸収支(月額)」で
   * 組まれているため。年額が要るようになったらB7の入力項目と合わせて拡張する。
   */
  type RealEstateRental = {
    /** 賃貸収入(円/月) */
    monthlyIncome: number;
    /** 賃貸支出(円/月)。管理費・修繕積立金など。プラスの値で持つ */
    monthlyExpense: number;
  };

  /**
   * ある日の時価とローン残高(`RealEstateValueHistory`の値)。
   *
   * **2つを組で持つ。** 利ざやを求めるときに「時価は3月の記録・ローン残高は7月の記録」
   * という実在しない日の組み合わせを作らないため
   * (docs/screen-requirements-real-estate.md B7「時価・ローン残高の履歴」)。
   * 片方だけが変わった保存でも両方を書く。
   */
  type RealEstateValueRecord = {
    marketValue: number;
    loanBalance: number;
  };

  /**
   * 時価・ローン残高の履歴。キーは記録した日(`yyyy-MM-dd`)。
   *
   * 資産推移グラフが各時点の物件の額を積むために使う
   * (docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
   * 負債の`DebtBalanceHistory`と同じく**追記のみ**で、過去の記録は書き換えない。
   */
  type RealEstateValueHistory = Record<string, RealEstateValueRecord>;

  /**
   * 物件1件(docs/screen-requirements-real-estate.md B5〜B7)。
   *
   * 利ざや(時価-ローン残高)はここに持たず、表示時に計算する
   * (`src/lib/real-estate/calculation.ts`)。保存された値と計算結果が食い違う状態を
   * 作らないため、要件どおり「自動計算」で通す。**履歴に積むのも時価とローン残高であって
   * 利ざやではない**(同2章)。B4で「時価を反映する」を選んだ物件は履歴の時価だけを使うので、
   * 利ざやを積んでいると使えない。
   */
  type RealEstateProperty = {
    id: string;
    /** 物件名 */
    name: string;
    /** 所在地。B7で登録した住所をそのまま持ち、B5は簡略表記に落として表示する。任意入力(空文字可) */
    location: string;
    /**
     * 取得年月(`yyyy-MM`)。未入力は`null`。
     *
     * 資産推移グラフがこの物件を積み始める起点になる(B1「不動産を含む分類軸の集計」)。
     * 未入力の物件は最初に記録した日が起点になるため、任意入力のままでも困らない。
     * 日まで持たないのはB11の発生年月と同じ理由で、推移グラフが月次の点で描くため。
     */
    acquiredOn: string | null;
    /** 時価(円)。手動更新の想定値(要件定義書 4.5) */
    marketValue: number;
    /** ローン残高(円)。完済済みの物件は0 */
    loanBalance: number;
    /**
     * 時価・ローン残高の履歴。保存のたびに、**どちらかが変わった物件についてのみ**
     * その日の値を組で積む(B7「時価・ローン残高の履歴」)。
     *
     * B4-8より前に登録された物件はこのフィールドを持たないため、読み出し側で空の
     * マップに倒す(`categoryAxes.debtIds`と同じ扱い)。その物件は次に保存した時点で
     * 最初の記録が積まれる。
     */
    valueHistory: RealEstateValueHistory;
    /**
     * 賃貸収支。**この値を持つ物件が収益物件**である。
     *
     * B7の「収益物件として登録」チェックボックスのオン/オフがそのままこの有無に対応する。
     * 区分のフラグと金額を別々に持つと「収益物件なのに金額が無い」「非収益物件なのに金額が
     * 残っている」という食い違いが型の上で作れてしまうため、1つにまとめている。
     */
    rental?: RealEstateRental;
    /**
     * 最終更新日(yyyy-MM-dd)。B7で保存したときの日付。
     *
     * 時価もローン残高も手動更新(要件定義書 4.5)で、いつ時点の値かが分からないと
     * 利ざやをどこまで信用してよいか判断できないため、B6で明示する。
     */
    updatedAt: string;
  };

  /**
   * B7で保存する物件の内容。
   *
   * `RealEstateProperty`との違いは、ID・最終更新日・履歴を含まないこと。いずれも入力項目では
   * なく保存時に決まる値で(IDは採番、最終更新日は保存日、履歴は前回の値との差から積む)、
   * リポジトリが埋める。
   *
   * 収益物件でない場合の`rental`は`undefined`ではなく`null`にする。Firestoreに
   * 「収益物件ではない」と明示的に書き込み、前回の賃貸収入/支出を残さないため
   * (docs/screen-requirements-real-estate.md B7)。取得年月も同じ理由で、未入力を`null`で書く。
   */
  type RealEstatePropertyInput = {
    name: string;
    location: string;
    acquiredOn: string | null;
    marketValue: number;
    loanBalance: number;
    rental: RealEstateRental | null;
  };

  /** B7 不動産登録・編集フォームの入力値(`realEstateFormSchema`から導出) */
  type RealEstateFormValues = z.infer<typeof realEstateFormSchema>;

  /** B7のモード。新規登録と編集で見出し・保存処理・キャンセルの戻り先が変わる */
  type RealEstateFormMode = "create" | "edit";

  /** 物件一覧の取得結果(B5) */
  type RealEstatePropertiesResult =
    | { ok: true; properties: RealEstateProperty[] }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * 物件1件の取得結果(B6・B7 編集モード)。
   *
   * 該当が無い場合は失敗ではなく`property: null`で返す。削除済みの物件を開いたときに
   * 「取得に失敗しました」ではなく「物件が見つかりません」を出し分けられるようにするため。
   */
  type RealEstatePropertyResult =
    | { ok: true; property: RealEstateProperty | null }
    | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * 物件の保存が失敗した理由。
   *
   * `history-limit-exceeded`だけはFirestoreへのアクセスの失敗ではなく、時価・ローン残高の
   * 履歴が上限に達している状態を指す(B11の残債の履歴と同じ扱い)。到達しない前提で置く
   * 歯止めだが、古い記録から捨てると過去の資産推移グラフが黙って変わるため保存を止める。
   */
  type RealEstateSaveFailureReason = FirestoreAccessFailureReason | "history-limit-exceeded";

  /** 物件の保存(登録・更新)結果。成功時のIDは保存後のB6への遷移に使う */
  type SaveRealEstatePropertyResult =
    { ok: true; id: string } | { ok: false; reason: RealEstateSaveFailureReason };

  /** 物件一覧(RealEstatePropertyList)のProps */
  type RealEstatePropertyListProps = {
    /** 表示順に並べた物件。並び替えの指定は要件に無いため、渡された順で表示する */
    properties: RealEstateProperty[];
  };

  /** 物件一覧の1行(RealEstatePropertyList内)のProps */
  type RealEstatePropertyRowProps = {
    property: RealEstateProperty;
  };

  /**
   * 物件IDを動的セグメント`[id]`で受ける画面のProps(B6 詳細・B7 編集モード)。
   *
   * Next.jsが`params`をPromiseで渡すため、画面側で`await`して取り出す。
   */
  type RealEstatePropertyPageProps = {
    params: Promise<{ id: string }>;
  };

  /** B6 不動産詳細画面の本体(RealEstateDetail)のProps */
  type RealEstateDetailProps = {
    property: RealEstateProperty;
  };

  /**
   * 賃貸収支カード(RealEstateDetail内)のProps。
   *
   * 物件ではなく`rental`そのものを受けるのは、収益物件かどうかの判定を呼び出し側に寄せ、
   * カード内で「`rental`が無ければ何も描かない」という分岐を持たせないため。
   */
  type RealEstateRentalCardProps = {
    rental: RealEstateRental;
  };

  /**
   * 物件IDを指定して1件を読む画面(B6 詳細・B7 編集モード)のProps。
   *
   * Firestoreの読み出しはブラウザ側でしかできないため、ページ(Server Component)は
   * `params`からIDを取り出して渡すだけにし、取得はClient Component側で行う。
   */
  type RealEstatePropertyScreenProps = {
    propertyId: string;
  };

  /**
   * 金額入力欄(RealEstateForm内)のProps。
   *
   * 時価・ローン残高・賃貸収入・賃貸支出の4欄が同じ見た目・同じ入力方式になるよう、
   * 欄ごとに`<Input>`の属性を書き並べずこのコンポーネントに寄せる。
   */
  type RealEstateAmountFieldProps = {
    /** `<label for>`と紐づけるID。フォームのフィールド名をそのまま使う */
    id: string;
    label: string;
    error?: FieldError;
    registration: UseFormRegisterReturn;
    disabled: boolean;
  };

  /** B7 不動産登録・編集フォームのProps */
  type RealEstateFormProps = {
    mode: RealEstateFormMode;
    /** 新規登録は空値、編集は既存の登録値を渡す */
    initialValues: RealEstateFormValues;
    /** 「キャンセル」の戻り先(新規登録はB5、編集はB6) */
    cancelHref: string;
    onSubmit: (input: RealEstatePropertyInput) => Promise<SaveRealEstatePropertyResult>;
  };
}
