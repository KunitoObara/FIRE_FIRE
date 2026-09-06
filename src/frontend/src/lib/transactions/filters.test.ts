import { describe, expect, it } from "vitest";

import {
  ALL_TRANSACTION_ACCOUNTS_VALUE,
  ALL_TRANSACTION_CATEGORIES_VALUE,
  ALL_TRANSACTION_CATEGORY_MINORS_VALUE,
} from "@/constants/transactions";
import {
  buildTransactionSelectOptions,
  buildTransactionsFilterBarKey,
  buildTransactionsHref,
  buildTransactionsPageSizeHref,
  buildTransactionSortHref,
  resolveCategoryMinorOptions,
  resolveTransactionFilters,
  resolveTransactionKeyword,
  resolveTransactionOption,
  resolveTransactionPage,
  resolveTransactionPageSize,
  resolveTransactionPeriodId,
  resolveTransactionSortDirection,
  resolveTransactionSortKey,
} from "@/lib/transactions/filters";

const categories = ["食費", "住居費"];
const categoryMinorsByMajor: Record<string, string[]> = {
  食費: ["外食", "食料品"],
  住居費: ["家賃"],
};

const baseFilters: TransactionFilters = {
  periodId: "1m",
  category: "",
  categoryMinor: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
  pageSize: 20,
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
  it("指定された値をそのまま使う", () => {
    expect(resolveTransactionOption("食費")).toBe("食費");
  });

  it("未指定は「すべて」(空文字)に落とす", () => {
    expect(resolveTransactionOption(undefined)).toBe("");
  });

  it("前後の空白は落とす(見えない差で別物にしない)", () => {
    expect(resolveTransactionOption("  食費  ")).toBe("食費");
  });

  /**
   * 期間を切り替えると選択肢の集合が変わる。ここで空文字へ落とすと、結果が0件なのは
   * 「本当に無い」からなのか「選択が外れた」からなのかを画面から区別できなくなる
   */
  it("読み込んだ期間に無い値でも落とさない", () => {
    expect(resolveTransactionOption("交通費")).toBe("交通費");
  });

  /**
   * 「すべて」のダミー値はRadix `Select`が空文字を許さないためのUI専用の値で、本来URLには
   * 現れない。そのまま採ると、セレクタは「すべて」を指したまま一覧だけがその文字列で絞られる
   */
  it("「すべて」のUI専用の値がURLに載っていても未選択として扱う", () => {
    expect(resolveTransactionOption(ALL_TRANSACTION_CATEGORIES_VALUE)).toBe("");
    expect(resolveTransactionOption(ALL_TRANSACTION_CATEGORY_MINORS_VALUE)).toBe("");
    expect(resolveTransactionOption(ALL_TRANSACTION_ACCOUNTS_VALUE)).toBe("");
  });
});

describe("buildTransactionSelectOptions", () => {
  it("選択肢をそのまま並べる", () => {
    expect(buildTransactionSelectOptions(categories, "")).toEqual([
      { value: "食費", label: "食費", available: true },
      { value: "住居費", label: "住居費", available: true },
    ]);
  });

  it("選択中の値が選択肢にあるなら足さない", () => {
    expect(buildTransactionSelectOptions(categories, "食費")).toHaveLength(categories.length);
  });

  /** 消すと0件の理由が画面から分からなくなるため、但し書きを添えて残す */
  it("選択中の値がその期間に無ければ、該当なしと添えて末尾に残す", () => {
    expect(buildTransactionSelectOptions(categories, "交通費").at(-1)).toEqual({
      value: "交通費",
      label: "交通費(この期間に該当なし)",
      available: false,
    });
  });
});

describe("resolveCategoryMinorOptions", () => {
  it("大項目を選ぶとその配下の中項目だけを並べる", () => {
    expect(resolveCategoryMinorOptions(categoryMinorsByMajor, "食費")).toEqual(["外食", "食料品"]);
  });

  it("大項目が未選択なら全ての中項目を並べる", () => {
    expect(resolveCategoryMinorOptions(categoryMinorsByMajor, "")).toEqual([
      "家賃",
      "外食",
      "食料品",
    ]);
  });

  /** 中項目だけで絞ったときは大項目をまたいで一致させるので、同名は1つにまとめる */
  it("複数の大項目に同じ中項目があっても1つにまとめる", () => {
    expect(resolveCategoryMinorOptions({ 食費: ["外食"], 交際費: ["外食"] }, "")).toEqual(["外食"]);
  });

  it("その期間に中項目を持たない大項目を選ぶと空になる", () => {
    expect(resolveCategoryMinorOptions(categoryMinorsByMajor, "交通費")).toEqual([]);
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

describe("resolveTransactionPageSize", () => {
  it("選択肢にある件数ならそのまま使う", () => {
    expect(resolveTransactionPageSize("50")).toBe(50);
    expect(resolveTransactionPageSize("100")).toBe(100);
  });

  it("未指定は既定の20件に落とす", () => {
    expect(resolveTransactionPageSize(undefined)).toBe(20);
  });

  /**
   * 任意の数を許すと、手で書き換えたURLで読み込んだ範囲の全件を1ページに並べられてしまう。
   * 範囲ではなく選択肢との一致で判定する
   */
  it("選択肢に無い値・数値でない値は既定の20件に落とす", () => {
    expect(resolveTransactionPageSize("30")).toBe(20);
    expect(resolveTransactionPageSize("9999")).toBe(20);
    expect(resolveTransactionPageSize("0")).toBe(20);
    expect(resolveTransactionPageSize("-50")).toBe(20);
    expect(resolveTransactionPageSize("abc")).toBe(20);
    expect(resolveTransactionPageSize("")).toBe(20);
  });
});

describe("resolveTransactionFilters", () => {
  it("クエリパラメータ一式から絞り込み・並び替え・ページの状態をまとめて決める", () => {
    expect(
      resolveTransactionFilters({
        period: "3m",
        category: "食費",
        subcategory: "外食",
        account: "現金",
        q: "スーパー",
        sort: "amount",
        dir: "asc",
        page: "2",
        size: "50",
      }),
    ).toEqual({
      periodId: "3m",
      category: "食費",
      categoryMinor: "外食",
      account: "現金",
      keyword: "スーパー",
      sortKey: "amount",
      sortDirection: "asc",
      page: 2,
      pageSize: 50,
    });
  });

  it("何も指定が無ければ既定値のみになる", () => {
    expect(resolveTransactionFilters({})).toEqual(baseFilters);
  });
});

describe("buildTransactionsHref", () => {
  it("既定値だけのときは期間・並び替えのみをクエリに載せる", () => {
    expect(buildTransactionsHref(baseFilters)).toBe("/transactions?period=1m&sort=date&dir=desc");
  });

  /** 日本語はURLSearchParamsによってパーセントエンコードされる */
  it("費目・中項目・口座・キーワード・ページを指定するとクエリに反映する", () => {
    const href = buildTransactionsHref({
      ...baseFilters,
      category: "食費",
      categoryMinor: "外食",
      account: "現金",
      keyword: "スーパー",
      page: 3,
    });

    expect(href).toBe(
      `/transactions?period=1m&category=${encodeURIComponent("食費")}&subcategory=${encodeURIComponent("外食")}&account=${encodeURIComponent("現金")}&q=${encodeURIComponent("スーパー")}&sort=date&dir=desc&page=3`,
    );
  });

  /** 既定の20件は`page`が1のときと同じくURLに出さない */
  it("既定以外の表示件数だけをクエリに載せる", () => {
    expect(buildTransactionsHref({ ...baseFilters, pageSize: 20 })).not.toContain("size=");
    expect(buildTransactionsHref({ ...baseFilters, pageSize: 100 })).toBe(
      "/transactions?period=1m&sort=date&dir=desc&size=100",
    );
  });
});

describe("buildTransactionsPageSizeHref", () => {
  it("選んだ表示件数をクエリに載せる", () => {
    expect(buildTransactionsPageSizeHref(50, baseFilters)).toBe(
      "/transactions?period=1m&sort=date&dir=desc&size=50",
    );
  });

  /**
   * 20件で3ページ目を見ている状態で100件へ広げると、同じ3ページ目は201〜300件目を指し、
   * いま見ていた行が画面から消える
   */
  it("表示件数を変えるとページは1に戻す", () => {
    expect(buildTransactionsPageSizeHref(100, { ...baseFilters, page: 3 })).toBe(
      "/transactions?period=1m&sort=date&dir=desc&size=100",
    );
  });

  it("絞り込み・並び替えは保ったままにする", () => {
    expect(
      buildTransactionsPageSizeHref(50, {
        ...baseFilters,
        category: "食費",
        sortKey: "amount",
        sortDirection: "asc",
      }),
    ).toBe(
      `/transactions?period=1m&category=${encodeURIComponent("食費")}&sort=amount&dir=asc&size=50`,
    );
  });
});

describe("buildTransactionsFilterBarKey", () => {
  it("期間・費目・中項目・口座・キーワードのいずれかが変わるとkeyも変わる", () => {
    const base = buildTransactionsFilterBarKey(baseFilters);

    expect(buildTransactionsFilterBarKey({ ...baseFilters, periodId: "3m" })).not.toBe(base);
    expect(buildTransactionsFilterBarKey({ ...baseFilters, category: "食費" })).not.toBe(base);
    expect(buildTransactionsFilterBarKey({ ...baseFilters, categoryMinor: "外食" })).not.toBe(base);
    expect(buildTransactionsFilterBarKey({ ...baseFilters, account: "現金" })).not.toBe(base);
    expect(buildTransactionsFilterBarKey({ ...baseFilters, keyword: "スーパー" })).not.toBe(base);
  });

  /** 並び替え・ページ・表示件数はこのフォームが管理しない値なので、変わってもkeyは変えない */
  it("並び替え・ページ・表示件数だけが変わってもkeyは変わらない", () => {
    const base = buildTransactionsFilterBarKey(baseFilters);

    expect(
      buildTransactionsFilterBarKey({
        ...baseFilters,
        sortKey: "amount",
        sortDirection: "asc",
        page: 3,
        pageSize: 100,
      }),
    ).toBe(base);
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
