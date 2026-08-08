"use client";

import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_ANIMATION_DURATION_MS, CHART_ANIMATION_EASING } from "@/constants/dashboard";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCompactJpy, formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

/**
 * 資産推移グラフ(B1)。
 *
 * 系列は1本だけなので凡例は置かない(何の値かはカードの見出しが示している)。
 * 代わりに任意の月の値を読めるよう、ホバーで日付と金額を出す。
 *
 * 系列名は選択中の分類軸の名前をそのまま使う。分類軸はユーザーが追加・編集するマスタデータで
 * (docs/fire-asset-management-requirements.md 4.3)、「総資産」等の固定名にはできない。
 *
 * 登場アニメーション(左から右へ描き出す)はRechartsに任せる。線と面を同じクリップで
 * 広げてくれるため、面だけ先に全幅で出ることがない(DESIGN.md 9章)。再生の引き金は
 * 呼び出し側が渡す`key`で、データが変わったときだけ作り直されて最初から描き直す。
 */
export const NetWorthTrendChart = ({ axisName, series }: NetWorthTrendChartProps): JSX.Element => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ChartContainer
      config={{ amount: { label: axisName, color: "var(--chart-1)" } } satisfies ChartConfig}
      className="h-56 w-full"
    >
      <AreaChart data={series} margin={{ left: 8, right: 8, top: 8 }}>
        {/* 目盛りは値を読む補助でしかないため、横線だけを薄く敷く */}
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value: string) => format(parseISO(value), "yyyy/MM")}
        />
        <YAxis
          dataKey="amount"
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={formatCompactJpy}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const date = payload[0]?.payload?.date;
                return typeof date === "string" ? format(parseISO(date), "yyyy年M月") : "";
              }}
              formatter={(value) => formatJpy(Number(value))}
            />
          }
        />
        <Area
          dataKey="amount"
          type="monotone"
          stroke="var(--color-amount)"
          strokeWidth={2}
          fill="var(--color-amount)"
          fillOpacity={0.08}
          // 点が60個並ぶと丸が潰れて線が読めなくなる。ホバー時だけ位置を示す
          dot={false}
          activeDot={{ r: 4 }}
          // 視差効果を減らす設定では最終状態を即座に描く(DESIGN.md 9章)
          isAnimationActive={!prefersReducedMotion}
          animationDuration={CHART_ANIMATION_DURATION_MS}
          animationEasing={CHART_ANIMATION_EASING}
        />
      </AreaChart>
    </ChartContainer>
  );
};
