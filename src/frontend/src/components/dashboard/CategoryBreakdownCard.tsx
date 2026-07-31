"use client";

import dynamic from "next/dynamic";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_EMPTY_STATES } from "@/constants/dashboard";
import { formatJpy, formatPercent } from "@/lib/format/currency";

import type { JSX } from "react";

const CategoryBreakdownChart = dynamic(
  async () =>
    (await import("@/components/dashboard/CategoryBreakdownChart")).CategoryBreakdownChart,
  { ssr: false, loading: () => <Skeleton className="size-36 rounded-full" /> },
);

/**
 * 分類別内訳のカード(B1)。
 *
 * 円グラフの色は3色ほど背景とのコントラストが3:1に届かないため、色だけに頼らず
 * 分類名と構成比を文字で併記する。凡例は色の判別が難しい場合の逃げ道でもある。
 */
export const CategoryBreakdownCard = ({
  axisName,
  slices,
}: CategoryBreakdownCardProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">分類別内訳({axisName})</CardTitle>
    </CardHeader>
    <CardContent>
      {slices.length === 0 ? (
        <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.breakdown} />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <CategoryBreakdownChart slices={slices} />
          <ul className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
            {slices.map((slice) => (
              <li key={slice.categoryId} className="flex items-center gap-2">
                {/*
                  色は分類ごとに実行時に決まる値なので、Tailwindのクラス名では表現できない
                  (ビルド時にクラス名を静的に列挙できないため)。ここだけstyle属性を使う
                */}
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span>{slice.name}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {formatPercent(slice.ratio)}
                </span>
                <span className="w-28 text-right text-muted-foreground tabular-nums">
                  {formatJpy(slice.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardContent>
  </Card>
);
