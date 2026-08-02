export {};

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
   * 物件1件(docs/screen-requirements-real-estate.md B5〜B7)。
   *
   * 利ざや(時価-ローン残高)はここに持たず、表示時に計算する
   * (`src/lib/real-estate/calculation.ts`)。保存された値と計算結果が食い違う状態を
   * 作らないため、要件どおり「自動計算」で通す。
   */
  type RealEstateProperty = {
    id: string;
    /** 物件名 */
    name: string;
    /** 所在地。B7で登録した住所をそのまま持ち、B5は簡略表記に落として表示する */
    location: string;
    /** 時価(円)。手動更新の想定値(要件定義書 4.5) */
    marketValue: number;
    /** ローン残高(円)。完済済みの物件は0 */
    loanBalance: number;
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
   * B6 不動産詳細画面のページのProps。
   *
   * 動的セグメント`[id]`をNext.jsがPromiseで渡すため、画面側で`await`して取り出す。
   *
   * 同じ`[id]`配下にあるB7 編集モードは、まだ既存値をプリセットする実装が無く物件IDを
   * 使っていないため、この型を受けていない。B7の実装時にこの型を共用するか編集モード用の
   * Props型を分けるかを決める。
   */
  type RealEstateDetailPageProps = {
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
}
