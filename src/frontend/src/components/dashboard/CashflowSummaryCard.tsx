import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CASHFLOW_DETAIL_LINK, DASHBOARD_EMPTY_STATES } from "@/constants/dashboard";
import { formatJpy, formatSignedJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * 収支サマリのカード(B1)。
 *
 * 収支の符号はプラスを`--success`、マイナスを`--destructive`で示すが、
 * 色だけに意味を持たせないよう金額側にも必ず符号を付ける(`formatSignedJpy`)。
 */
export const CashflowSummaryCard = ({ cashflow }: CashflowSummaryCardProps): JSX.Element => {
  const balance = cashflow === null ? 0 : cashflow.income - cashflow.expense;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">収支サマリ(今月)</CardTitle>
        <CardAction>
          <Link
            href={CASHFLOW_DETAIL_LINK.href}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {CASHFLOW_DETAIL_LINK.label}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {cashflow === null ? (
          <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.cashflow} />
        ) : (
          <>
            <dl className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">収入</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatJpy(cashflow.income)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">支出</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatJpy(cashflow.expense)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">収支</dt>
                <dd
                  className={
                    balance < 0
                      ? "text-lg font-semibold text-destructive tabular-nums"
                      : "text-lg font-semibold text-success tabular-nums"
                  }
                >
                  {formatSignedJpy(balance)}
                </dd>
              </div>
            </dl>
            <ul className="flex flex-col gap-2 text-sm">
              {cashflow.expenseByCategory.map((item) => (
                <li key={item.name} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatJpy(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
};
