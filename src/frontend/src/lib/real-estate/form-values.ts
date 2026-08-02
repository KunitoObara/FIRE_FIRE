/**
 * B7 不動産登録・編集フォームの入力値と、保存する物件データの相互変換。
 *
 * フォームは金額を文字列で持ち(`src/schemas/real-estate.ts`)、Firestoreには数値で保存する。
 * 変換をここに閉じ込め、画面とリポジトリのどちらにも「文字列と数値のどちらで扱うか」の
 * 判断を持たせない。
 */

/**
 * 入力値を保存する形に変換する。**バリデーション通過後の値にのみ使う**
 * (金額が半角数字であることは`realEstateFormSchema`が保証している)。
 *
 * 「収益物件として登録」がオフのときは賃貸収入/支出を保持しない
 * (docs/screen-requirements-real-estate.md B7)。入力欄に値が残っていても捨てる。
 */
export const toRealEstatePropertyInput = (
  values: RealEstateFormValues,
): RealEstatePropertyInput => ({
  name: values.name,
  location: values.location,
  marketValue: Number(values.marketValue),
  loanBalance: Number(values.loanBalance),
  rental: values.isRentalProperty
    ? {
        monthlyIncome: Number(values.rentalMonthlyIncome),
        monthlyExpense: Number(values.rentalMonthlyExpense),
      }
    : null,
});

/**
 * 登録済みの物件を編集モードの初期値に変換する(B7の表示項目「(編集時)既存の登録値」)。
 *
 * 収益物件でない物件は賃貸の入力欄を空にする。前の物件の値が残ることは無い。
 */
export const toRealEstateFormValues = (property: RealEstateProperty): RealEstateFormValues => ({
  name: property.name,
  location: property.location,
  marketValue: String(property.marketValue),
  loanBalance: String(property.loanBalance),
  isRentalProperty: property.rental !== undefined,
  rentalMonthlyIncome: property.rental === undefined ? "" : String(property.rental.monthlyIncome),
  rentalMonthlyExpense: property.rental === undefined ? "" : String(property.rental.monthlyExpense),
});
