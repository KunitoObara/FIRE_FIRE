import { fetchTransactions } from "@/lib/csv-import/transaction-repository";

/**
 * B3が表示する取引データを組み立てる(docs/screen-requirements-dashboard.md B3)。
 *
 * B2で取り込んだ`users/{uid}/transactions`を選択中の期間だけ読み、費目・口座のセレクタの
 * 選択肢をそこから作る。**費目マスタは持たない**(B4の資産分類軸とは別物)ので、選択肢は
 * 取り込んだ取引そのものから導く(docs/transaction-import-requirements.md 6章)。
 *
 * 取得は`fetchTransactions`に任せ、ここは表示に要る形へ整えるだけにしてある。B1が
 * `fetchDashboardData`で複数のリポジトリの結果を束ねているのと同じ役割分担。
 */

/**
 * 選択肢を作る。空文字は選択肢に出さない。
 *
 * 中項目が空の取引は「(未分類)」等の名前をアプリ側で与えず空のまま扱うと決めており(6章)、
 * 名前の無いものをセレクタに並べても選べる意味が無い。
 *
 * 並びは五十音・アルファベット順(`localeCompare`)にする。取引の出現順にすると、期間を
 * 切り替えるたびに同じ費目が別の位置へ動いて探せなくなる。
 */
const collectOptions = (values: string[]): string[] =>
  [...new Set(values.filter((value) => value !== ""))].sort((left, right) =>
    left.localeCompare(right, "ja"),
  );

export const fetchTransactionsData = async (
  periodId: TransactionPeriodId,
  now: Date,
): Promise<TransactionsDataResult> => {
  const result = await fetchTransactions(periodId, now);

  if (!result.ok) {
    return result;
  }

  const { transactions } = result;

  return {
    ok: true,
    truncated: result.truncated,
    data: {
      transactions,
      // 費目の選択肢は大項目で作る。中項目での絞り込みは別途足す
      categories: collectOptions(transactions.map((transaction) => transaction.categoryMajor)),
      accounts: collectOptions(transactions.map((transaction) => transaction.account)),
    },
  };
};
