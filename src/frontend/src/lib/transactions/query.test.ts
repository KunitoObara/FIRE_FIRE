import { describe, expect, it } from "vitest";

import {
  filterTransactions,
  paginateTransactions,
  sortTransactions,
} from "@/lib/transactions/query";

const NOW = new Date("2026-07-31T00:00:00.000Z");

const baseFilters: TransactionFilters = {
  periodId: "all",
  category: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
};

const transactions: Transaction[] = [
  {
    id: "a",
    date: "2026-07-18",
    category: "給与",
    account: "普通預金(三井住友)",
    amount: 420_000,
    description: "給与振込",
  },
  {
    id: "b",
    date: "2026-07-19",
    category: "住居費",
    account: "普通預金(三井住友)",
    amount: -98_000,
    description: "家賃引き落とし",
  },
  {
    id: "c",
    date: "2026-07-20",
    category: "食費",
    account: "楽天カード",
    amount: -3_280,
    description: "イオン",
  },
  {
    id: "d",
    date: "2026-07-17",
    category: "交通費",
    account: "楽天カード",
    amount: -1_200,
    description: "JR東日本",
  },
];

const idsOf = (result: Transaction[]): string[] => result.map((transaction) => transaction.id);

describe("filterTransactions", () => {
  it("費目で絞り込む", () => {
    expect(
      idsOf(filterTransactions(transactions, { ...baseFilters, category: "食費" }, NOW)),
    ).toEqual(["c"]);
  });

  it("口座で絞り込む", () => {
    expect(
      idsOf(filterTransactions(transactions, { ...baseFilters, account: "楽天カード" }, NOW)),
    ).toEqual(["c", "d"]);
  });

  it("摘要のキーワードで絞り込む(大小文字を区別しない)", () => {
    const withMixedCase: Transaction[] = [
      ...transactions,
      {
        id: "e",
        date: "2026-07-21",
        category: "食費",
        account: "楽天カード",
        amount: -2_000,
        description: "AEON Mall",
      },
    ];

    expect(
      idsOf(filterTransactions(withMixedCase, { ...baseFilters, keyword: "aeon" }, NOW)),
    ).toEqual(["e"]);
  });

  it("費目・口座・キーワードは組み合わせて絞り込める(AND条件)", () => {
    expect(
      idsOf(
        filterTransactions(
          transactions,
          { ...baseFilters, account: "楽天カード", keyword: "JR" },
          NOW,
        ),
      ),
    ).toEqual(["d"]);
  });

  it("条件が無指定なら期間以外は絞り込まない", () => {
    expect(idsOf(filterTransactions(transactions, baseFilters, NOW))).toEqual(idsOf(transactions));
  });

  it("該当が無ければ空になる", () => {
    expect(filterTransactions(transactions, { ...baseFilters, category: "娯楽費" }, NOW)).toEqual(
      [],
    );
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
