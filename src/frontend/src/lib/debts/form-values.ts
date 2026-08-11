import { MONTHS_PER_YEAR } from "@/constants/debts";

/**
 * B11 負債入力フォームの入力値(文字列)と、保存・表示に使う値(数値)の相互変換。
 *
 * フォーム側が文字列を持つ理由は`src/schemas/debts.ts`のとおり。変換をコンポーネントに
 * 散らすと「空文字を0と読むか未登録と読むか」の判断が場所ごとにぶれるため、ここに集める。
 */

/** 画面上で「負債を追加」したときの空の行。保存されるまで`id`は`null` */
export const buildEmptyDebtRow = (): DebtRowFormValues => ({
  id: null,
  name: "",
  balance: "",
  originatedOn: "",
  interestRate: "",
  repaymentYears: "",
  repaymentMonths: "",
  updatedAt: null,
});

/** 未登録(`null`)は空文字にする。0は正当な値なので`0`のまま出す */
const toInputValue = (value: number | null): string => (value === null ? "" : String(value));

/**
 * 保存済みの負債をフォームの行に変換する。
 *
 * 総月数は「年」「ヶ月」の2欄へ割り戻す。保存は総月数で行うが、入力・表示は
 * 「◯年◯ヶ月」に組み立て直すのが要件(docs/screen-requirements-dashboard.md B11)。
 * 未登録(`null`)のときだけ両方の欄を空にする。総月数0は「0年0ヶ月」であって未登録ではない。
 */
export const toDebtRowFormValues = (debt: Debt): DebtRowFormValues => ({
  id: debt.id,
  name: debt.name,
  balance: String(debt.balance),
  // 未登録(`null`)は空文字。`<input type="month">`は空文字で「未入力」を表す
  originatedOn: debt.originatedOn ?? "",
  interestRate: toInputValue(debt.interestRate),
  repaymentYears:
    debt.repaymentMonths === null ? "" : String(Math.floor(debt.repaymentMonths / MONTHS_PER_YEAR)),
  repaymentMonths:
    debt.repaymentMonths === null ? "" : String(debt.repaymentMonths % MONTHS_PER_YEAR),
  updatedAt: debt.updatedAt,
});

/** 任意入力の数値欄。空文字は「未登録」を意味する */
const toOptionalNumber = (value: string): number | null =>
  value.length === 0 ? null : Number(value);

/**
 * 「年」「ヶ月」の2欄を総月数へ正規化する。
 *
 * **片方の欄だけが入力された場合は、空欄側を0として扱う**(年=5・ヶ月=空欄 → 60ヶ月)。
 * エラーにはしない — 任意入力の欄で「5年ちょうど」を表すのに0の明示を強いるのは冗長なため。
 * **両方が空欄のときだけ未登録**(`null`)とし、総月数0(=「0年0ヶ月」)と区別する
 * (docs/screen-requirements-dashboard.md B11「バリデーション」)。
 */
export const toRepaymentMonths = (years: string, months: string): number | null => {
  if (years.length === 0 && months.length === 0) {
    return null;
  }

  return (
    Number(years.length === 0 ? 0 : years) * MONTHS_PER_YEAR +
    Number(months.length === 0 ? 0 : months)
  );
};

/** フォームの行を保存する形へ変換する */
export const toDebtInput = (row: DebtRowFormValues): DebtInput => ({
  id: row.id,
  name: row.name.trim(),
  balance: Number(row.balance),
  // 空文字は「未登録」。0や今月に倒すと、入力していない負債の反映の起点が勝手に決まる
  originatedOn: row.originatedOn.length === 0 ? null : row.originatedOn,
  interestRate: toOptionalNumber(row.interestRate),
  repaymentMonths: toRepaymentMonths(row.repaymentYears, row.repaymentMonths),
});

/** フォーム全体を保存する形へ変換する */
export const toDebtInputs = (values: DebtFormValues): DebtInput[] => values.debts.map(toDebtInput);
