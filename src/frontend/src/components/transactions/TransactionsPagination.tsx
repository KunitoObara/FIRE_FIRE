"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  TRANSACTION_PAGINATION_SIBLING_COUNT,
  TRANSACTION_PAGINATION_SIBLING_COUNT_COMPACT,
} from "@/constants/transactions";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildTransactionsHref } from "@/lib/transactions/filters";
import { buildPaginationItems } from "@/lib/transactions/pagination";

import type { JSX } from "react";

/**
 * B3のページネーション(番号 + 省略記号 + 「前へ」「次へ」)。
 *
 * 遷移は`buildTransactionsHref`が返すURLへの`Link`で行い、状態はURLに一本化する
 * (CODING_STANDARDS.md 2章)。並び替えの列見出しと同じ扱いで、絞り込みバーのように
 * 送信ボタンで確定させない。
 *
 * **番号の窓は画面幅で変える。** モバイルでは横に並べられる数が少なく、そのままの窓だと
 * 折り返して「前へ」「次へ」の位置がずれる。CSSで一部を隠す方式は採らない — 隠した結果
 * 「1 4 7」のように省略記号を伴わない飛びが残ることがあり、間にページが無いように読める。
 */
export const TransactionsPagination = ({
  filters,
  totalPages,
}: TransactionsPaginationProps): JSX.Element => {
  const isMobile = useIsMobile();
  const items = buildPaginationItems(
    filters.page,
    totalPages,
    isMobile ? TRANSACTION_PAGINATION_SIBLING_COUNT_COMPACT : TRANSACTION_PAGINATION_SIBLING_COUNT,
  );

  const buildHref = (page: number): string => buildTransactionsHref({ ...filters, page });

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          {/* 先頭ページでは遷移先が無い。リンクごと消すと「次へ」の位置が左へずれる */}
          <PaginationPrevious href={filters.page > 1 ? buildHref(filters.page - 1) : undefined} />
        </PaginationItem>

        {items.map((item, index) =>
          item === "ellipsis" ? (
            /*
              省略記号自体は番号を持たないので、直前のページ番号でkeyを作る。省略記号は
              必ず番号に挟まれ、同じ番号の直後に2つ並ぶことはないため一意になる
            */
            <PaginationItem key={`ellipsis-after-${items[index - 1]}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink href={buildHref(item)} isActive={item === filters.page}>
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={filters.page < totalPages ? buildHref(filters.page + 1) : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};
