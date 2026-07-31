"use client";

import dynamic from "next/dynamic";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_EMPTY_STATES } from "@/constants/dashboard";

import type { JSX } from "react";

/**
 * Rechartsは描画にブラウザのAPIを使うため、サーバー側では読み込まない
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
const NetWorthTrendChart = dynamic(
  async () => (await import("@/components/dashboard/NetWorthTrendChart")).NetWorthTrendChart,
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
);

/**
 * 資産推移グラフのカード(B1)。
 *
 * 見出しに分類軸の名前を入れる。推移は選択中の分類軸で集計した金額なので、
 * 「総資産推移」と固定で名乗ると投資性資産などを選んだときに中身と食い違う。
 */
export const NetWorthTrendCard = ({ axisName, series }: NetWorthTrendCardProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">資産推移({axisName})</CardTitle>
    </CardHeader>
    <CardContent>
      {series.length === 0 ? (
        <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.netWorth} />
      ) : (
        <NetWorthTrendChart axisName={axisName} series={series} />
      )}
    </CardContent>
  </Card>
);
