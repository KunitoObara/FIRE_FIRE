import { describe, expect, it } from "vitest";

import { buildPaginationItems } from "@/lib/transactions/pagination";

/** 既定の窓(`TRANSACTION_PAGINATION_SIBLING_COUNT`)と同じ値 */
const SIBLING_COUNT = 2;

describe("buildPaginationItems", () => {
  it("全部が窓に収まるなら省略記号を出さない", () => {
    expect(buildPaginationItems(1, 3, SIBLING_COUNT)).toEqual([1, 2, 3]);
  });

  it("ページが1つだけならそのページだけを出す", () => {
    expect(buildPaginationItems(1, 1, SIBLING_COUNT)).toEqual([1]);
  });

  it("先頭付近では末尾側だけを畳む", () => {
    expect(buildPaginationItems(1, 20, SIBLING_COUNT)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
  });

  it("中盤では両側を畳む", () => {
    expect(buildPaginationItems(10, 20, SIBLING_COUNT)).toEqual([
      1,
      "ellipsis",
      8,
      9,
      10,
      11,
      12,
      "ellipsis",
      20,
    ]);
  });

  it("末尾付近では先頭側だけを畳む", () => {
    expect(buildPaginationItems(20, 20, SIBLING_COUNT)).toEqual([
      1,
      "ellipsis",
      16,
      17,
      18,
      19,
      20,
    ]);
  });

  /**
   * 端に寄っても番号の数を変えない。先頭では左に出せないぶんを右へ、末尾では逆へ寄せる。
   * 幅が伸び縮みすると、ページを送るたびに「次へ」の位置が動いて押し間違いを誘う
   */
  it("端に寄っても並ぶ番号の数を保つ", () => {
    const atStart = buildPaginationItems(1, 20, SIBLING_COUNT);
    const inMiddle = buildPaginationItems(10, 20, SIBLING_COUNT);
    const atEnd = buildPaginationItems(20, 20, SIBLING_COUNT);

    const countNumbers = (items: TransactionPaginationItem[]): number =>
      items.filter((item) => item !== "ellipsis").length;

    expect(countNumbers(atStart)).toBe(6);
    expect(countNumbers(inMiddle)).toBe(7);
    expect(countNumbers(atEnd)).toBe(6);
  });

  /**
   * 「1 … 3」のように省略記号が1ページだけを隠すと、押せば飛べる番号を1つ畳むために
   * 同じ幅を使うことになり、間に何ページあるのかも読めなくなる
   */
  it("隙間が1ページだけなら省略記号にせず番号を出す", () => {
    expect(buildPaginationItems(1, 7, SIBLING_COUNT)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  /** モバイルでは窓を狭める(`TRANSACTION_PAGINATION_SIBLING_COUNT_COMPACT`) */
  it("窓を0にすると先頭・現在・末尾だけになる", () => {
    expect(buildPaginationItems(10, 20, 0)).toEqual([1, "ellipsis", 10, "ellipsis", 20]);
  });

  it("窓を0にしても現在ページが先頭・末尾と重なれば重複しない", () => {
    expect(buildPaginationItems(1, 20, 0)).toEqual([1, "ellipsis", 20]);
    expect(buildPaginationItems(20, 20, 0)).toEqual([1, "ellipsis", 20]);
  });
});
