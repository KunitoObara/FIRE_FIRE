import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Card, CardContent } from "@/components/ui/card";
import {
  NO_TRANSACTIONS_EMPTY_STATE,
  SAMPLE_TRANSACTIONS_DATA_NOTICE,
  TRANSACTIONS_PAGE_SIZE,
  USE_SAMPLE_TRANSACTIONS_DATA,
} from "@/constants/transactions";
import {
  buildTransactionsFilterBarKey,
  resolveTransactionFilters,
} from "@/lib/transactions/filters";
import {
  filterTransactions,
  paginateTransactions,
  sortTransactions,
} from "@/lib/transactions/query";
import { getTransactionsData } from "@/lib/transactions/transactions-data";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "収支明細一覧 | FIRE-FIRE",
};

/**
 * B3 収支明細一覧画面(docs/screen-requirements-dashboard.md B3)。参照専用画面であり、
 * 取引データの編集・削除機能は持たない。
 *
 * 絞り込み・並び替え・ページはURLのクエリパラメータから読む。この画面自体はServer Componentの
 * ままで、フォーム操作・並び替えヘッダ・ページングボタンだけをClient Componentに切り出している
 * (B1 ダッシュボード画面と同じ構成)。
 *
 * 表示データはまだFirestoreに繋がっておらず、`getTransactionsData`がサンプルデータを返す
 * (`src/constants/transactions.ts`の`USE_SAMPLE_TRANSACTIONS_DATA`)。入出金明細CSVの取込
 * (B2)自体がまだ未実装のため、実データへの繋ぎ込みは別カードで行う。
 */
const TransactionsPage = async (props: PageProps<"/transactions">): Promise<JSX.Element> => {
  const searchParams = await props.searchParams;
  const now = new Date();
  const data = getTransactionsData(now);
  const filters = resolveTransactionFilters(searchParams, data);

  const filtered = filterTransactions(data.transactions, filters, now);
  const sorted = sortTransactions(filtered, filters.sortKey, filters.sortDirection);
  const paged = paginateTransactions(sorted, filters.page, TRANSACTIONS_PAGE_SIZE);
  const resolvedFilters: TransactionFilters = { ...filters, page: paged.page };

  return (
    <>
      <TransactionsFilterBar
        key={buildTransactionsFilterBarKey(resolvedFilters)}
        categories={data.categories}
        accounts={data.accounts}
        filters={resolvedFilters}
      />

      {USE_SAMPLE_TRANSACTIONS_DATA ? (
        <p className="text-xs text-muted-foreground">{SAMPLE_TRANSACTIONS_DATA_NOTICE}</p>
      ) : null}

      {data.transactions.length === 0 ? (
        <Card>
          <CardContent>
            <DashboardEmptyState {...NO_TRANSACTIONS_EMPTY_STATE} />
          </CardContent>
        </Card>
      ) : (
        <TransactionsTable
          rows={paged.rows}
          filters={resolvedFilters}
          totalCount={paged.totalCount}
          totalPages={paged.totalPages}
          pageSize={TRANSACTIONS_PAGE_SIZE}
        />
      )}
    </>
  );
};

export default TransactionsPage;
