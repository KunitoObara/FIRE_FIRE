import { format, parseISO } from "date-fns";

import { CashflowSummaryCard } from "@/components/dashboard/CashflowSummaryCard";
import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { FireProgressCard } from "@/components/dashboard/FireProgressCard";
import { GoogleLinkFailureNotice } from "@/components/dashboard/GoogleLinkFailureNotice";
import { NetWorthTrendCard } from "@/components/dashboard/NetWorthTrendCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_AXIS_PARAM,
  DASHBOARD_PERIOD_PARAM,
  NO_ASSET_AXIS_EMPTY_STATE,
  NO_CSV_IMPORT_LABEL,
  SAMPLE_DASHBOARD_DATA_NOTICE,
  USE_SAMPLE_DASHBOARD_DATA,
} from "@/constants/dashboard";
import { buildBreakdownSlices } from "@/lib/dashboard/category-color";
import { getDashboardData } from "@/lib/dashboard/dashboard-data";
import { resolveAxisId, resolvePeriodId } from "@/lib/dashboard/filters";
import { filterSeriesByPeriod } from "@/lib/dashboard/period";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "ダッシュボード | FIRE-FIRE",
};

/** 直近CSV取込日時の表示。未取込のときは日時の代わりにその旨を出す */
const formatLastImportedAt = (isoDateTime: string | null): string =>
  isoDateTime === null ? NO_CSV_IMPORT_LABEL : format(parseISO(isoDateTime), "yyyy/MM/dd HH:mm");

/**
 * B1 ダッシュボード画面(docs/screen-requirements-dashboard.md B1)。
 *
 * 分類軸・表示期間はURLのクエリパラメータから読む。この画面自体はServer Componentのままで、
 * グラフの描画とフィルタの操作だけをClient Componentに切り出している。
 *
 * 表示データはまだFirestoreに繋がっておらず、`getDashboardData`がサンプルデータを返す
 * (`src/constants/dashboard.ts`の`USE_SAMPLE_DASHBOARD_DATA`)。
 *
 * A8経由のログインで起こりうる「Googleアカウント連携の失敗通知」(同要件のB1)は、
 * `GoogleLinkFailureNotice`がトーストで出す。連携失敗が無ければ何もしない。
 */
const DashboardPage = async (props: PageProps<"/dashboard">): Promise<JSX.Element> => {
  const searchParams = await props.searchParams;
  const now = new Date();
  const data = getDashboardData(now);

  const selectedAxisId = resolveAxisId(searchParams[DASHBOARD_AXIS_PARAM], data.axes);
  const selectedPeriodId = resolvePeriodId(searchParams[DASHBOARD_PERIOD_PARAM]);
  const selectedAxis = data.axes.find((axis) => axis.id === selectedAxisId);
  const axisData = selectedAxisId === undefined ? undefined : data.byAxis[selectedAxisId];

  const series = filterSeriesByPeriod(axisData?.netWorthSeries ?? [], selectedPeriodId, now);
  const slices = buildBreakdownSlices(axisData?.breakdown ?? [], data.categories);

  return (
    <>
      <GoogleLinkFailureNotice />

      <DashboardFilters
        axes={data.axes}
        selectedAxisId={selectedAxisId ?? ""}
        selectedPeriodId={selectedPeriodId}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-xs text-muted-foreground">
          直近CSV取込:{" "}
          <span className="tabular-nums">{formatLastImportedAt(data.lastImportedAt)}</span>
        </p>
        {USE_SAMPLE_DASHBOARD_DATA ? (
          <p className="text-xs text-muted-foreground">{SAMPLE_DASHBOARD_DATA_NOTICE}</p>
        ) : null}
      </div>

      {selectedAxis === undefined ? (
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
  );
};

export default DashboardPage;
