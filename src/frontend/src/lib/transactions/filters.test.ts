import { describe, expect, it } from "vitest";

import {
  buildTransactionsHref,
  buildTransactionSortHref,
  resolveTransactionFilters,
  resolveTransactionKeyword,
  resolveTransactionOption,
  resolveTransactionPage,
  resolveTransactionPeriodId,
  resolveTransactionSortDirection,
  resolveTransactionSortKey,
} from "@/lib/transactions/filters";

const data: TransactionsData = {
  transactions: [],
  categories: ["食費", "住居費"],
  accounts: ["楽天カード", "現金"],
};

const baseFilters: TransactionFilters = {
  periodId: "1m",
  category: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
};

describe("resolveTransactionPeriodId", () => {
  it("選択肢にある期間ならそのまま使う", () => {
    expect(resolveTransactionPeriodId("this-year")).toBe("this-year");
  });

  it("未指定なら既定の直近1ヶ月に落とす", () => {
    expect(resolveTransactionPeriodId(undefined)).toBe("1m");
  });

  it("選択肢に無い値も既定の直近1ヶ月に落とす", () => {
    expect(resolveTransactionPeriodId("10y")).toBe("1m");
  });
});

describe("resolveTransactionOption", () => {
  it("取引データに存在する値ならそのまま使う", () => {
    expect(resolveTransactionOption("食費", data.categories)).toBe("食費");
  });

  it("未指定は「すべて」(空文字)に落とす", () => {
    expect(resolveTransactionOption(undefined, data.categories)).toBe("");
  });

  /** B4のような削除操作は無いが、手で書き換えたURLが存在しない値を指す場合は同様に扱う */
  it("取引データに存在しない値も「すべて」に落とす", () => {
    expect(resolveTransactionOption("交通費", data.categories)).toBe("");
  });
});

describe("resolveTransactionKeyword", () => {
  it("前後の空白を除いた値を使う", () => {
    expect(resolveTransactionKeyword("  イオン  ")).toBe("イオン");
  });

  it("未指定は空文字に落とす", () => {
    expect(resolveTransactionKeyword(undefined)).toBe("");
  });
});

describe("resolveTransactionSortKey / resolveTransactionSortDirection", () => {
  it("amountは金額列として扱う", () => {
    expect(resolveTransactionSortKey("amount")).toBe("amount");
  });

  it("amount以外・未指定は既定の日付列に落とす", () => {
    expect(resolveTransactionSortKey("category")).toBe("date");
    expect(resolveTransactionSortKey(undefined)).toBe("date");
  });

  it("ascは昇順として扱う", () => {
    expect(resolveTransactionSortDirection("asc")).toBe("asc");
  });

  it("asc以外・未指定は既定の降順に落とす", () => {
    expect(resolveTransactionSortDirection("invalid")).toBe("desc");
    expect(resolveTransactionSortDirection(undefined)).toBe("desc");
  });
});

describe("resolveTransactionPage", () => {
  it("1以上の整数ならそのまま使う", () => {
    expect(resolveTransactionPage("3")).toBe(3);
  });

  it("未指定・0以下・数値でない値は1に落とす", () => {
    expect(resolveTransactionPage(undefined)).toBe(1);
    expect(resolveTransactionPage("0")).toBe(1);
    expect(resolveTransactionPage("-1")).toBe(1);
    expect(resolveTransactionPage("abc")).toBe(1);
  });
});

describe("resolveTransactionFilters", () => {
  it("クエリパラメータ一式から絞り込み・並び替え・ページの状態をまとめて決める", () => {
    expect(
      resolveTransactionFilters(
        {
          period: "3m",
          category: "食費",
          account: "現金",
          q: "イオン",
          sort: "amount",
          dir: "asc",
          page: "2",
        },
        data,
      ),
    ).toEqual({
      periodId: "3m",
      category: "食費",
      account: "現金",
      keyword: "イオン",
      sortKey: "amount",
      sortDirection: "asc",
      page: 2,
    });
  });

  it("何も指定が無ければ既定値のみになる", () => {
    expect(resolveTransactionFilters({}, data)).toEqual(baseFilters);
  });
});

describe("buildTransactionsHref", () => {
  it("既定値だけのときは期間・並び替えのみをクエリに載せる", () => {
    expect(buildTransactionsHref(baseFilters)).toBe("/transactions?period=1m&sort=date&dir=desc");
  });

  /** 日本語はURLSearchParamsによってパーセントエンコードされる */
  it("費目・口座・キーワード・ページを指定するとクエリに反映する", () => {
    expect(
      buildTransactionsHref({
        ...baseFilters,
        category: "食費",
        account: "現金",
        keyword: "イオン",
        page: 3,
      }),
    ).toBe(
      "/transactions?period=1m&category=%E9%A3%9F%E8%B2%BB&account=%E7%8F%BE%E9%87%91&q=%E3%82%A4%E3%82%AA%E3%83%B3&sort=date&dir=desc&page=3",
    );
  });
});

describe("buildTransactionSortHref", () => {
  it("非選択中の列を押すと降順から始める", () => {
    expect(buildTransactionSortHref("amount", baseFilters)).toBe(
      "/transactions?period=1m&sort=amount&dir=desc",
    );
  });

  it("選択中の列を再度押すと降順→昇順に切り替える", () => {
    expect(buildTransactionSortHref("date", baseFilters)).toBe(
      "/transactions?period=1m&sort=date&dir=asc",
    );
  });

  it("選択中の列を再度押すと昇順→降順に切り替える", () => {
    expect(buildTransactionSortHref("date", { ...baseFilters, sortDirection: "asc" })).toBe(
      "/transactions?period=1m&sort=date&dir=desc",
    );
  });

  /** 並び替えを変えると表示されるページの中身が変わるため、ページは1に戻る */
  it("2ページ目以降から並び替えると1ページ目に戻す", () => {
    expect(buildTransactionSortHref("amount", { ...baseFilters, page: 3 })).toBe(
      "/transactions?period=1m&sort=amount&dir=desc",
    );
  });
});
