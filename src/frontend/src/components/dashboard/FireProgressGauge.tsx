"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { toGaugeRatio } from "@/lib/dashboard/fire-progress";
import { formatPercent } from "@/lib/format/currency";

import type { JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  rate: { label: "達成率", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * FIRE達成度ゲージ(B1)。
 *
 * 塗りは0〜100%で止めるが、中央に出す数値は実際の達成率をそのまま出す。
 * 目標を超えている場合に「100%」としか出ないと、超過分が見えなくなるため
 * (`src/lib/dashboard/fire-progress.ts`)。
 */
export const FireProgressGauge = ({ achievementRate }: FireProgressGaugeProps): JSX.Element => (
  <div className="relative h-36 w-36 shrink-0">
    <ChartContainer config={chartConfig} className="h-36 w-36">
      <RadialBarChart
        data={[{ name: "rate", value: toGaugeRatio(achievementRate) * 100 }]}
        innerRadius="72%"
        outerRadius="100%"
        startAngle={90}
        endAngle={-270}
      >
        {/* 0〜100%を1周に対応させる。これが無いとデータの最大値が1周になってしまう */}
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          dataKey="value"
          background={{ fill: "var(--secondary)" }}
          fill="var(--color-rate)"
          cornerRadius={4}
          // 中央の数値は即座に出るのに輪だけ遅れて伸びると、両者が食い違って見える。
          // 他のグラフと揃えて登場アニメーションは使わない(DESIGN.md 1章)
          isAnimationActive={false}
        />
      </RadialBarChart>
    </ChartContainer>
    <p
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums"
    >
      {formatPercent(achievementRate)}
    </p>
  </div>
);
