import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEBT_SUMMARY_EMPTY_STATE, DEBT_SUMMARY_ROW_LIMIT } from "@/constants/dashboard";
import { DEBT_SCREEN_LINK } from "@/constants/debts";
import {
  formatDebtInterestRate,
  formatRepaymentPeriod,
  resolveLatestUpdatedAt,
  sortDebtsByBalance,
} from "@/lib/debts/summary";
import { formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * 負債サマリのカード(docs/screen-requirements-dashboard.md B1「負債サマリ」)。
 *
 * 登録済みの負債(B11)を**分類軸とは無関係にそのまま並べる**。分類軸切替セレクタで
 * 絞ると、負債を集計対象に選んでいない軸を表示中に「登録したはずの負債が消える」ことになる。
 * 負債を分類軸に効かせるかどうかは資産との差引をどう見るかの話で、負債そのものの一覧とは別。
 *
 * 並びは**残債の多い順**。B11の並び順(登録順)ではなく金額順にするのは、ここが
 * 「いま何をどれだけ返済中か」を把握するための表示のため。
 */
export const DebtSummaryCard = ({ debts }: DebtSummaryCardProps): JSX.Element => {
  const sorted = sortDebtsByBalance(debts);
  const shown = sorted.slice(0, DEBT_SUMMARY_ROW_LIMIT);
  const remaining = sorted.length - shown.length;
  const total = debts.reduce((sum, debt) => sum + debt.balance, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">負債サマリ</CardTitle>
        <CardAction>
          <Link
            href={DEBT_SCREEN_LINK.href}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {DEBT_SCREEN_LINK.label}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {debts.length === 0 ? (
          // 負債が無いこと自体はエラーではないので、空状態としてB11への導線を出す
          <DashboardEmptyState {...DEBT_SUMMARY_EMPTY_STATE} />
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted-foreground">負債合計</p>
              {/* 負債の金額には必ずラベルを添える(DESIGN.md 3章) */}
              <p className="text-2xl font-bold text-destructive tabular-nums">{formatJpy(total)}</p>
            </div>

            <ul className="flex flex-col gap-2 text-sm">
              {shown.map((debt) => (
                <li key={debt.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 truncate">{debt.name}</span>
                  {/*
                    金利・残りの返済期間はB11で任意入力なので未登録がありうる。
                    未登録の項目は欄を空にし、0%や0ヶ月とは表示しない(同要件B1)
                  */}
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                    {formatDebtInterestRate(debt.interestRate)}
                  </span>
                  <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                    {formatRepaymentPeriod(debt.repaymentMonths)}
                  </span>
                  <span className="w-28 text-right tabular-nums">{formatJpy(debt.balance)}</span>
                </li>
              ))}
            </ul>

            {/* 件数が多い場合は上位のみを出し、残りは件数で示してB11へ渡す(同要件B1) */}
            {remaining > 0 ? (
              <p className="text-xs text-muted-foreground">ほか{remaining}件</p>
            ) : null}

            {/*
              最終更新日はB11で最後に保存した日付。時価と同じく手動更新のため、
              いつ時点の残債かが分からないと信用してよいか判断できない(B6と同じ考え方)
            */}
            <p className="text-xs text-muted-foreground">
              最終更新 <span className="tabular-nums">{resolveLatestUpdatedAt(debts)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
