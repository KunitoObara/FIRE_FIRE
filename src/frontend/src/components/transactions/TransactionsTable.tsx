"use client";

import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { TransactionsPagination } from "@/components/transactions/TransactionsPagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildTransactionsPageSizeOptionLabel,
  NO_MATCHING_TRANSACTIONS_LABEL,
  NON_CALCULATION_TARGET_BADGE_DESCRIPTION,
  NON_CALCULATION_TARGET_BADGE_LABEL,
  TRANSACTIONS_PAGE_SIZE_LABEL,
  TRANSACTIONS_PAGE_SIZE_OPTIONS,
  TRANSFER_BADGE_DESCRIPTION,
  TRANSFER_BADGE_LABEL,
} from "@/constants/transactions";
import { formatSignedJpy } from "@/lib/format/currency";
import {
  buildTransactionsPageSizeHref,
  buildTransactionSortHref,
} from "@/lib/transactions/filters";

import type { ColumnDef } from "@tanstack/react-table";
import type { JSX } from "react";

const PAGE_SIZE_SELECT_ID = "transactions-page-size";

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
    accessorKey: "categoryMajor",
    header: "費目",
    /*
      大項目を主・中項目を従として1列に収める(docs/screen-requirements-dashboard.md B3)。
      絞り込んだ結果がどの中項目なのかが行から読めないと、絞り込みの結果を確かめられない。
      中項目が空の取引は大項目だけを出し、「(未分類)」のような名前をアプリ側で与えない
      (docs/transaction-import-requirements.md 6章)
    */
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{row.original.categoryMajor}</Badge>
        {row.original.categoryMinor ? (
          <span className="text-xs text-muted-foreground">{row.original.categoryMinor}</span>
        ) : null}
      </span>
    ),
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
    accessorKey: "content",
    header: "摘要",
    /*
      収支の集計から外れる行に印を付ける(docs/screen-requirements-dashboard.md B3)。
      印が無いと、一覧の金額を足してもB1の収支サマリと合わない理由が分からない。
      **振替と計算対象外は別の印**にする — 前者はマネーフォワードが自動で付ける分類、
      後者はユーザーが下した判断で、意味が違う(docs/transaction-import-requirements.md 5章)。
      両方に当てはまる行では2つとも出す。片方だけにすると、印を手掛かりに理由を
      確かめようとしたときにもう一方の理由が消える
    */
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">{row.original.content}</span>
        {row.original.isTransfer ? (
          <Badge variant="outline" title={TRANSFER_BADGE_DESCRIPTION}>
            {TRANSFER_BADGE_LABEL}
          </Badge>
        ) : null}
        {!row.original.isCalculationTarget ? (
          <Badge variant="outline" title={NON_CALCULATION_TARGET_BADGE_DESCRIPTION}>
            {NON_CALCULATION_TARGET_BADGE_LABEL}
          </Badge>
        ) : null}
      </span>
    ),
  },
];

/**
 * B3の取引一覧テーブル(参照専用。編集・削除機能は持たない — DESIGN.md 6章)。
 *
 * 並び替えは列見出しのリンクでURLの`sort`/`dir`を切り替えて実現し、ページング(`page`)と
 * 表示件数(`size`)も同様にURLに持たせる。@tanstack/react-tableはヘッダ・行の描画にのみ使い、
 * 並び替え・ページングの状態はサーバー側(page.tsx)がURLから計算した結果をそのまま渡すだけの
 * 手動制御とする(`manualSorting`相当。DESIGN.md 7章の指定に沿いつつ、状態はURLに一本化する
 * CODING_STANDARDS.md 2章の方針を優先する)。
 */
export const TransactionsTable = ({
  rows,
  filters,
  totalCount,
  totalPages,
}: TransactionsTableProps): JSX.Element => {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(filters), [filters]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  const rangeStart = totalCount === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const rangeEnd = Math.min(filters.page * filters.pageSize, totalCount);

  /*
    表示件数はセレクタなので`Link`にできない(Radix `Select`はリンクを選択肢にしない)。
    並び替え・ページ送りと同じ「選んだ時点でURLへ即反映する」グループの操作なので、
    絞り込みバーのように送信ボタンで確定させず、その場で`router.push`する。
    遷移先の組み立ては`buildTransactionsPageSizeHref`に寄せてあり、状態はURLに一本化したまま。
  */
  const handlePageSizeChange = (value: string): void => {
    router.push(buildTransactionsPageSizeHref(Number(value), filters));
  };

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
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="tabular-nums">
            {totalCount}件中 {rangeStart}〜{rangeEnd}件を表示
          </span>

          <div className="flex items-center gap-2">
            <Label htmlFor={PAGE_SIZE_SELECT_ID} className="text-xs text-muted-foreground">
              {TRANSACTIONS_PAGE_SIZE_LABEL}
            </Label>
            <Select value={String(filters.pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger id={PAGE_SIZE_SELECT_ID} size="sm" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTIONS_PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {buildTransactionsPageSizeOptionLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TransactionsPagination filters={filters} totalPages={totalPages} />
      </CardFooter>
    </Card>
  );
};
