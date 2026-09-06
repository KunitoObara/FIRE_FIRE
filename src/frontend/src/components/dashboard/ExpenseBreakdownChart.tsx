"use client";

import { Cell, Pie, PieChart } from "recharts";

import styles from "@/components/dashboard/ExpenseBreakdownChart.module.css";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatJpy } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

/**
 * 費目別支出の円グラフ(B1の収支サマリ)。
 *
 * 費目は**金額の多い順**に描く(`buildExpenseSlices`)。並べ替えも色の割り当ても
 * あちらが済ませてあるので、ここは渡された順にそのまま描く。
 *
 * **色は分類別内訳と割り当ての軸が別**で、同じ色が同じものを指すわけではない。費目が8件以下の
 * 月は`--chart-*`を共有し、9件以上の月はその場で作った色になる([B1-18](https://trello.com/c/UTWWqbpy))。
 * 生成した色は隣接ペアの識別性を事前に検証できないため、**費目を見分ける手がかりは
 * カード側の凡例に並ぶ費目名**である(円の上に数値を重ねないのは分類別内訳と揃えたもの)。
 *
 * 登場アニメーション(12時から時計回りのスイープ)はCSSマスクが担う
 * (`ExpenseBreakdownChart.module.css`。理由もそこに書いてある)。再生の引き金は
 * 呼び出し側が渡す`key`で、対象月やデータが変わったときだけこのコンポーネントが
 * 作り直されて最初から再生される。
 */
export const ExpenseBreakdownChart = ({ slices }: ExpenseBreakdownChartProps): JSX.Element => {
  // 費目は取り込んだ取引から動的に決まるので、設定も描画時に組み立てる
  const chartConfig = Object.fromEntries(
    slices.map((slice) => [slice.categoryId, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={cn(styles.chartSweep, "aspect-square h-36")}>
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              hideLabel
              formatter={(value) => formatJpy(Number(value))}
            />
          }
        />
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="name"
          innerRadius="55%"
          outerRadius="100%"
          // 隣り合う色が直に接すると境界が見えなくなるため、背景色の隙間を挟む
          paddingAngle={1.5}
          stroke="var(--card)"
          strokeWidth={2}
          // `paddingAngle`と併用するとRechartsが角度を広げきれず、開始フレーム
          // (ほぼ0度の扇形)のまま止まって円が出ない。スイープは`ExpenseBreakdownChart.module.css`
          // のCSSマスクで行うので、Recharts側のアニメーションは止めたままにする(DESIGN.md 9章)
          isAnimationActive={false}
        >
          {slices.map((slice) => (
            <Cell key={slice.categoryId} fill={slice.color} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
