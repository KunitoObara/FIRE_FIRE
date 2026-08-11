import { describe, expect, it } from "vitest";

import {
  filterTransactions,
  paginateTransactions,
  sortTransactions,
} from "@/lib/transactions/query";

const baseFilters: TransactionFilters = {
  periodId: "all",
  category: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
};

/** 検証に関係する列だけを指定して1件作る(値はすべて架空) */
const buildTransaction = (transaction: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-07-20",
  content: "サンプル",
  amount: -1_000,
  account: "楽天カード",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...transaction,
});

const transactions: Transaction[] = [
  buildTransaction({
    id: "a",
    date: "2026-07-18",
    categoryMajor: "収入",
    categoryMinor: "給与",
    account: "普通預金(〇〇銀行)",
    amount: 420_000,
    content: "給与振込",
  }),
  buildTransaction({
    id: "b",
    date: "2026-07-19",
    categoryMajor: "住居費",
    categoryMinor: "家賃",
    account: "普通預金(〇〇銀行)",
    amount: -98_000,
    content: "家賃引き落とし",
  }),
  buildTransaction({
    id: "c",
    date: "2026-07-20",
    categoryMajor: "食費",
    categoryMinor: "食料品",
    account: "〇〇カード",
    amount: -3_280,
    content: "スーパー〇〇",
  }),
  buildTransaction({
    id: "d",
    date: "2026-07-17",
    categoryMajor: "交通費",
    categoryMinor: "電車",
    account: "〇〇カード",
    amount: -1_200,
    content: "〇〇鉄道",
  }),
];

const idsOf = (result: Transaction[]): string[] => result.map((transaction) => transaction.id);

describe("filterTransactions", () => {
  /** 費目は大項目で突き合わせる。中項目での絞り込みは別に足す */
  it("費目(大項目)で絞り込む", () => {
    expect(idsOf(filterTransactions(transactions, { ...baseFilters, category: "食費" }))).toEqual([
      "c",
    ]);
  });

  it("中項目が一致しても大項目が違えば残さない", () => {
    const sameMinor = [
      buildTransaction({ id: "e", categoryMajor: "娯楽費", categoryMinor: "食費" }),
    ];

    expect(filterTransactions(sameMinor, { ...baseFilters, category: "食費" })).toEqual([]);
  });

  it("口座で絞り込む", () => {
    expect(
      idsOf(filterTransactions(transactions, { ...baseFilters, account: "〇〇カード" })),
    ).toEqual(["c", "d"]);
  });

  it("摘要のキーワードで絞り込む(大小文字を区別しない)", () => {
    const withMixedCase: Transaction[] = [
      ...transactions,
      buildTransaction({ id: "e", date: "2026-07-21", content: "AEON Mall" }),
    ];

    expect(idsOf(filterTransactions(withMixedCase, { ...baseFilters, keyword: "aeon" }))).toEqual([
      "e",
    ]);
  });

  it("費目・口座・キーワードは組み合わせて絞り込める(AND条件)", () => {
    expect(
      idsOf(
        filterTransactions(transactions, {
          ...baseFilters,
          account: "〇〇カード",
          keyword: "鉄道",
        }),
      ),
    ).toEqual(["d"]);
  });

  it("条件が無指定なら絞り込まない", () => {
    expect(idsOf(filterTransactions(transactions, baseFilters))).toEqual(idsOf(transactions));
  });

  /**
   * 期間はFirestoreの範囲クエリで絞り済み。ここで重ねて絞ると同じ条件を2箇所で持つことになり、
   * 片方だけを直したときに読めているのに表示から落ちる取引が出る
   */
  it("期間では絞り込まない(選択中の期間はFirestoreから読む時点で絞られている)", () => {
    const old = [buildTransaction({ id: "old", date: "2020-01-01" })];

    expect(idsOf(filterTransactions(old, { ...baseFilters, periodId: "1m" }))).toEqual(["old"]);
  });

  it("該当が無ければ空になる", () => {
    expect(filterTransactions(transactions, { ...baseFilters, category: "娯楽費" })).toEqual([]);
  });
});

describe("sortTransactions", () => {
  it("日付の降順(既定)で並び替える", () => {
    expect(idsOf(sortTransactions(transactions, "date", "desc"))).toEqual(["c", "b", "a", "d"]);
  });

  it("日付の昇順で並び替える", () => {
    expect(idsOf(sortTransactions(transactions, "date", "asc"))).toEqual(["d", "a", "b", "c"]);
  });

  it("金額の降順で並び替える(収入が先頭)", () => {
    expect(idsOf(sortTransactions(transactions, "amount", "desc"))).toEqual(["a", "d", "c", "b"]);
  });

  it("金額の昇順で並び替える(支出額が大きい順)", () => {
    expect(idsOf(sortTransactions(transactions, "amount", "asc"))).toEqual(["b", "c", "d", "a"]);
  });

  it("元の配列を変更しない", () => {
    const original = [...transactions];
    sortTransactions(transactions, "date", "asc");

    expect(transactions).toEqual(original);
  });
});

describe("paginateTransactions", () => {
  it("ページサイズで区切って返す", () => {
    const result = paginateTransactions(transactions, 1, 2);

    expect(idsOf(result.rows)).toEqual(["a", "b"]);
    expect(result).toMatchObject({ totalCount: 4, totalPages: 2, page: 1 });
  });

  it("2ページ目を返す", () => {
    const result = paginateTransactions(transactions, 2, 2);

    expect(idsOf(result.rows)).toEqual(["c", "d"]);
  });

  it("範囲外のページ指定は末尾ページに丸める", () => {
    const result = paginateTransactions(transactions, 99, 2);

    expect(result.page).toBe(2);
    expect(idsOf(result.rows)).toEqual(["c", "d"]);
  });

  it("0件のときは1ページ・0件のまま返す", () => {
    const result = paginateTransactions([], 1, 20);

    expect(result).toEqual({ rows: [], totalCount: 0, totalPages: 1, page: 1 });
  });
});
