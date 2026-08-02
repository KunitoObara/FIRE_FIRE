export {};

declare global {
  /**
   * 物件1件(docs/screen-requirements-real-estate.md B5〜B7)。
   *
   * 現時点ではB5 不動産一覧画面が表示する項目だけを持つ。B6が表示する賃貸収入/支出や
   * 「収益物件として登録」の区分はB7の登録フォームと対で決まるため、その実装時に足す。
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
}
