"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";

import { CashflowSummaryCard } from "@/components/dashboard/CashflowSummaryCard";
import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { FireProgressCard } from "@/components/dashboard/FireProgressCard";
import { NetWorthTrendCard } from "@/components/dashboard/NetWorthTrendCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_DATA_QUERY_KEY,
  DASHBOARD_FAILURE_MESSAGES,
  NO_ASSET_AXIS_EMPTY_STATE,
  NO_CSV_IMPORT_LABEL,
} from "@/constants/dashboard";
import { buildBreakdownSlices } from "@/lib/dashboard/category-color";
import { fetchDashboardData } from "@/lib/dashboard/dashboard-data";
import { resolveAxisId, resolvePeriodId } from "@/lib/dashboard/filters";
import { filterSeriesByPeriod } from "@/lib/dashboard/period";

import type { JSX } from "react";

/** 直近CSV取込日時の表示。未取込のときは日時の代わりにその旨を出す */
const formatLastImportedAt = (isoDateTime: string | null): string =>
  isoDateTime ? format(parseISO(isoDateTime), "yyyy/MM/dd HH:mm") : NO_CSV_IMPORT_LABEL;

/**
 * B1 ダッシュボード画面の本体(docs/screen-requirements-dashboard.md B1)。
 *
 * B2 CSV取込・B4 資産分類マスタ・B8 FIRE目標がFirestoreへ書いたデータを読んで表示する。
 * 取得がブラウザ側のFirebase SDK頼み(サーバー側から`uid`を特定できない)なので、
 * 画面本体をClient Componentにしている。B4・B5と同じ理由・同じ構成。
 *
 * 分類軸の切り替えは資産推移グラフと分類別内訳の両方に及ぶ(同要件B1)。切り替えのたびに
 * Firestoreを引き直さず、1度読んだ資産残高を分類軸ごとに集計した結果から選ぶだけにしている。
 */
export const DashboardScreen = ({ axisParam, periodParam }: DashboardScreenProps): JSX.Element => {
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_DATA_QUERY_KEY,
    queryFn: fetchDashboardData,
  });

  // 期間の絞り込みの基準時刻。レンダーのたびに進むと同じ表示が揺れるため1度だけ決める
  const now = useMemo(() => new Date(), []);

  const result = dashboardQuery.data;
  const data = result?.ok ? result.data : null;
  // 失敗の判定だけは真偽値の比較で行う。取得前(`undefined`)と失敗を区別する必要があるため
  const failureReason = result !== undefined && !result.ok ? result.reason : null;
  const axes = data?.axes ?? [];

  const selectedAxisId = resolveAxisId(axisParam, axes);
  const selectedPeriodId = resolvePeriodId(periodParam);
  const selectedAxis = axes.find((axis) => axis.id === selectedAxisId);
  const axisData = selectedAxisId ? data?.byAxis[selectedAxisId] : undefined;

  const series = filterSeriesByPeriod(axisData?.netWorthSeries ?? [], selectedPeriodId, now);
  const slices = buildBreakdownSlices(axisData?.breakdown ?? [], data?.categories ?? []);

  return (
    <>
      <DashboardFilters
        axes={axes}
        selectedAxisId={selectedAxisId ?? ""}
        selectedPeriodId={selectedPeriodId}
      />

      {dashboardQuery.isPending ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-60 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </div>
      ) : null}

      {failureReason ? (
        <p role="alert" className="text-sm text-destructive">
          {DASHBOARD_FAILURE_MESSAGES[failureReason]}
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-muted-foreground">
            直近CSV取込:{" "}
            <span className="tabular-nums">{formatLastImportedAt(data.lastImportedAt)}</span>
          </p>

          {!selectedAxis ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">資産の表示</CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardEmptyState {...NO_ASSET_AXIS_EMPTY_STATE} />
              </CardContent>
            </Card>
          ) : (
            <>
              <NetWorthTrendCard axisName={selectedAxis.name} series={series} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <CategoryBreakdownCard axisName={selectedAxis.name} slices={slices} />
                <FireProgressCard fireProgress={data.fireProgress} />
              </div>
            </>
          )}

          <CashflowSummaryCard cashflow={data.cashflow} />
        </>
      ) : null}
    </>
  );
};
