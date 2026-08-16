"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildTransactionsTruncatedNotice,
  NO_TRANSACTIONS_EMPTY_STATE,
  NO_TRANSACTIONS_IN_PERIOD_EMPTY_STATE,
  TRANSACTION_PERIOD_PARAM,
  TRANSACTION_SCAN_LIMIT,
  TRANSACTIONS_DATA_QUERY_KEY,
  TRANSACTIONS_LOAD_FAILURE_MESSAGES,
  TRANSACTIONS_PAGE_SIZE,
} from "@/constants/transactions";
import {
  buildTransactionsFilterBarKey,
  resolveTransactionFilters,
  resolveTransactionPeriodId,
} from "@/lib/transactions/filters";
import {
  filterTransactions,
  paginateTransactions,
  sortTransactions,
} from "@/lib/transactions/query";
import { fetchTransactionsData } from "@/lib/transactions/transactions-data";

import type { JSX } from "react";

/**
 * B3 収支明細一覧画面の本体(docs/screen-requirements-dashboard.md B3)。参照専用画面であり、
 * 取引データの編集・削除機能は持たない。
 *
 * B2で取り込んだ取引をFirestoreから読む。取得がブラウザ側のFirebase SDK頼み(サーバー側から
 * `uid`を特定できない)なので、画面本体をClient Componentにしている。B1・B4・B11と同じ構成。
 *
 * **Firestoreから読むのは選択中の期間の分だけ**で、費目・口座・キーワードの絞り込みと
 * 並び替え・ページングは読み込んだ範囲に対してクライアント側で行う
 * (docs/transaction-import-requirements.md 8章)。そのため期間だけは取得のキーに含める。
 */
export const TransactionsScreen = ({ searchParams }: TransactionsScreenProps): JSX.Element => {
  // 期間だけは取得の前に決まっている必要がある。他の絞り込みと違い、読む範囲そのものを変える
  const periodId = resolveTransactionPeriodId(searchParams[TRANSACTION_PERIOD_PARAM]);

  const transactionsQuery = useQuery({
    /*
      期間をキーに含めるので、切り替えると読み直す代わりに戻ってきたときは即座に出せる。
      B2の取込完了時は`TRANSACTIONS_DATA_QUERY_KEY`(前方一致)で無効化されるため、
      どの期間で見ていたキャッシュも一度に落ちる
    */
    queryKey: [...TRANSACTIONS_DATA_QUERY_KEY, periodId],
    queryFn: () => fetchTransactionsData(periodId, new Date()),
    /*
      自動リトライはしない。`fetchTransactionsData`はFirestoreの失敗を`ok: false`として
      「解決」させるので、ここへ例外が届くことは基本的に無い。B1と同じ扱い
    */
    retry: false,
  });

  if (transactionsQuery.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const result = transactionsQuery.data;

  // 取得の失敗を空状態(未取込)として見せない。次にすべきことが正反対になる
  if (!result || !result.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {TRANSACTIONS_LOAD_FAILURE_MESSAGES[result?.reason ?? "unknown"]}
      </p>
    );
  }

  const { data, truncated } = result;
  const filters = resolveTransactionFilters(searchParams);
  const filtered = filterTransactions(data.transactions, filters);
  const sorted = sortTransactions(filtered, filters.sortKey, filters.sortDirection);
  const paged = paginateTransactions(sorted, filters.page, TRANSACTIONS_PAGE_SIZE);
  const resolvedFilters: TransactionFilters = { ...filters, page: paged.page };

  return (
    <>
      <TransactionsFilterBar
        key={buildTransactionsFilterBarKey(resolvedFilters)}
        categories={data.categories}
        categoryMinorsByMajor={data.categoryMinorsByMajor}
        accounts={data.accounts}
        filters={resolvedFilters}
      />

      {/*
        打ち切ったことは黙って伏せない。古い側が欠けたまま出すと、一覧に無いことを
        「取り込んでいない」と読み違える(同書8章)
      */}
      {truncated ? (
        <p role="status" className="text-xs text-muted-foreground">
          {buildTransactionsTruncatedNotice(TRANSACTION_SCAN_LIMIT)}
        </p>
      ) : null}

      {/*
        取引が0件の状態は3つあり、それぞれ次にすべきことが違うので言い分ける。
        絞り込みに一致しない0件は表の中(`NO_MATCHING_TRANSACTIONS_LABEL`)で、ここに出すのは
        読み込んだ範囲そのものが空だった場合。**「全期間」で0件のときだけ「まだ無い」と言える** —
        期間を絞って読んでいる以上、他の期間に取引があるかどうかをこの画面は知らないため
      */}
      {data.transactions.length === 0 ? (
        <Card>
          <CardContent>
            <DashboardEmptyState
              {...(periodId === "all"
                ? NO_TRANSACTIONS_EMPTY_STATE
                : NO_TRANSACTIONS_IN_PERIOD_EMPTY_STATE)}
            />
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
