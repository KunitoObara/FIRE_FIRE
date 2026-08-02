/**
 * 物件の金額計算(docs/screen-requirements-real-estate.md B6)。
 *
 * 利ざや・賃貸収支は保存せず、表示のたびにここで求める。時価やローン残高を更新したのに
 * 保存済みの計算結果が古いまま、という食い違いを作らないため。
 */

/**
 * 利ざや(時価 - ローン残高)。要件定義書 4.5 の「利ざや計算」。
 *
 * ローン残高が時価を上回る(オーバーローン)物件では負になる。負の値を0で止めたりせず
 * そのまま返し、表示側で符号と色を付ける。
 */
export const calculateRealEstateSpread = (property: RealEstateProperty): number =>
  property.marketValue - property.loanBalance;

/** 賃貸収支(賃貸収入 - 賃貸支出、月額)。支出が上回る月は負になる */
export const calculateRentalBalance = (rental: RealEstateRental): number =>
  rental.monthlyIncome - rental.monthlyExpense;
