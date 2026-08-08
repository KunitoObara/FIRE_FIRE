"use client";

import dynamic from "next/dynamic";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BREAKDOWN_NET_AMOUNT_LABEL,
  buildBreakdownKey,
  DASHBOARD_EMPTY_STATES,
  DEBT_CATEGORY_ID,
  DEBT_LEGEND_SWATCH_BACKGROUND,
} from "@/constants/dashboard";
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
  netAmount,
}: CategoryBreakdownCardProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">分類別内訳({axisName})</CardTitle>
    </CardHeader>
    <CardContent>
      {slices.length === 0 ? (
        <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.breakdown} />
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            負債のスライスを置くと構成比の分母が「資産合計 + 負債合計」に変わり、
            %が純資産に対する割合ではなくなる。負債を含む分類軸でだけ差引後の純額を
            数字で併記して、そのことが分かるようにする(同要件B1)
          */}
          {netAmount !== null ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs text-muted-foreground">{BREAKDOWN_NET_AMOUNT_LABEL}</span>
              <span className="font-semibold tabular-nums">{formatJpy(netAmount)}</span>
              <span className="text-xs text-muted-foreground">
                (構成比の分母は資産と負債の合計です)
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-6">
            {/*
              `key`にデータの署名を渡し、データが差し替わったときだけ作り直してスイープを
              最初から再生する(資産推移グラフと同じ扱い。DESIGN.md 9章)。
              凡例の構成比・金額はアニメーションさせないので、この作り直しの対象に含めない
            */}
            <CategoryBreakdownChart key={buildBreakdownKey(axisName, slices)} slices={slices} />
            <ul className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
              {slices.map((slice) => (
                <li key={slice.categoryId} className="flex items-center gap-2">
                  {/*
                    色は分類ごとに実行時に決まる値なので、Tailwindのクラス名では表現できない
                    (ビルド時にクラス名を静的に列挙できないため)。ここだけstyle属性を使う。
                    負債の色見本はグラフのスライスと同じハッチングを重ねる — 見本とスライスの
                    見た目が違うと対応が取れない(DESIGN.md 3章)
                  */}
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={
                      slice.categoryId === DEBT_CATEGORY_ID
                        ? { backgroundImage: DEBT_LEGEND_SWATCH_BACKGROUND }
                        : { backgroundColor: slice.color }
                    }
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
        </div>
      )}
    </CardContent>
  </Card>
);
