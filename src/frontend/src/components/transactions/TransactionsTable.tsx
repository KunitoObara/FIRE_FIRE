"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NO_MATCHING_TRANSACTIONS_LABEL } from "@/constants/transactions";
import { formatSignedJpy } from "@/lib/format/currency";
import { buildTransactionsHref, buildTransactionSortHref } from "@/lib/transactions/filters";

import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";

/** 並び替え可能な列見出し。押すたびにその列の昇順/降順を切り替える(TransactionsTable内専用) */
const SortableColumnHeader = ({
  label,
  column,
  filters,
}: TransactionSortableColumnHeaderProps): JSX.Element => {
  const isActive = filters.sortKey === column;

  return (
    <Link
      href={buildTransactionSortHref(column, filters)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <span aria-hidden className={isActive ? "text-foreground" : "text-muted-foreground"}>
        {isActive && filters.sortDirection === "asc" ? "▴" : "▾"}
      </span>
    </Link>
  );
};

const buildColumns = (filters: TransactionFilters): ColumnDef<Transaction>[] => [
  {
    accessorKey: "date",
    header: () => <SortableColumnHeader label="日付" column="date" filters={filters} />,
    cell: ({ row }) => format(parseISO(row.original.date), "yyyy/MM/dd"),
  },
  {
    accessorKey: "category",
    header: "費目",
    cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge>,
  },
  {
    accessorKey: "amount",
    header: () => <SortableColumnHeader label="金額" column="amount" filters={filters} />,
    cell: ({ row }) => (
      <span className={row.original.amount < 0 ? "text-destructive" : "text-success"}>
        {formatSignedJpy(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "account",
    header: "口座",
  },
  {
    accessorKey: "description",
    header: "摘要",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.description}</span>,
  },
];

/**
 * B3の取引一覧テーブル(参照専用。編集・削除機能は持たない — DESIGN.md 6章)。
 *
 * 並び替えは列見出しのリンクでURLの`sort`/`dir`を切り替えて実現し、ページングも同様に
 * URL(`page`)に持たせる。@tanstack/react-tableはヘッダ・行の描画にのみ使い、並び替え・
 * ページングの状態はサーバー側(page.tsx)がURLから計算した結果をそのまま渡すだけの
 * 手動制御とする(`manualSorting`相当。DESIGN.md 7章の指定に沿いつつ、状態はURLに一本化する
 * CODING_STANDARDS.md 2章の方針を優先する)。
 */
export const TransactionsTable = ({
  rows,
  filters,
  totalCount,
  totalPages,
  pageSize,
}: TransactionsTableProps): JSX.Element => {
  const columns = useMemo(() => buildColumns(filters), [filters]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const rangeStart = totalCount === 0 ? 0 : (filters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(filters.page * pageSize, totalCount);
  const previousHref =
    filters.page > 1 ? buildTransactionsHref({ ...filters, page: filters.page - 1 }) : null;
  const nextHref =
    filters.page < totalPages
      ? buildTransactionsHref({ ...filters, page: filters.page + 1 })
      : null;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.id === "amount" ? "text-right" : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {NO_MATCHING_TRANSACTIONS_LABEL}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "amount" ? "text-right tabular-nums" : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {totalCount}件中 {rangeStart}〜{rangeEnd}件を表示
        </span>
        <div className="flex gap-1">
          {previousHref === null ? (
            <Button variant="outline" size="sm" disabled>
              前へ
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={previousHref}>前へ</Link>
            </Button>
          )}
          {nextHref === null ? (
            <Button variant="outline" size="sm" disabled>
              次へ
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={nextHref}>次へ</Link>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};
