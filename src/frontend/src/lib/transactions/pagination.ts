/**
 * ページ番号の並びを組み立てる(B3 収支明細一覧のページネーション)。
 *
 * **先頭・末尾・現在ページの周辺だけを番号で出し、間は省略記号で畳む。** 全期間・20件表示だと
 * 最大500ページ(`TRANSACTION_SCAN_LIMIT` 9,999件 ÷ 20)になりうるため、番号を全部並べる形は
 * 取れない(docs/screen-requirements-dashboard.md B3)。離れたページへは期間・絞り込みで寄せる。
 *
 * **1ページぶんの隙間は省略記号にせず、その番号をそのまま出す。** 「1 … 3」のように省略記号が
 * 1ページだけを隠すと、押せば飛べる番号を1つ畳むために同じ幅を使うことになり、
 * 畳んだ意味が無いうえ「間に何ページあるのか」も読めなくなる。
 *
 * @param currentPage 現在のページ(1始まり)。範囲外の値は呼び出し側で丸めてある前提
 * @param totalPages 総ページ数(1以上)
 * @param siblingCount 現在ページの左右に出す番号の数。モバイルでは狭める
 */
export const buildPaginationItems = (
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): TransactionPaginationItem[] => {
  const firstPage = 1;
  const lastPage = Math.max(1, totalPages);

  /*
    先頭・末尾は常に出す。現在ページが端に寄っているときも窓の幅を保ちたいので、
    左右にはみ出した分は反対側へ寄せる(先頭付近でも末尾付近でも番号の数が変わらない)。
  */
  const windowSize = siblingCount * 2 + 1;
  const windowStart = Math.min(
    Math.max(firstPage, currentPage - siblingCount),
    Math.max(firstPage, lastPage - windowSize + 1),
  );
  const windowEnd = Math.min(lastPage, Math.max(windowStart + windowSize - 1, currentPage));

  const pages = new Set<number>([firstPage, lastPage]);
  for (let page = windowStart; page <= windowEnd; page += 1) {
    pages.add(page);
  }

  const sorted = [...pages].sort((left, right) => left - right);
  const items: TransactionPaginationItem[] = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];

    if (previous !== undefined) {
      const gap = page - previous;

      // 隙間が1ページだけならその番号を出す。2ページ以上のときだけ畳む
      if (gap === 2) {
        items.push(previous + 1);
      } else if (gap > 2) {
        items.push("ellipsis");
      }
    }

    items.push(page);
  });

  return items;
};
