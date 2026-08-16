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
 * 費目は名前順に描く(`buildExpenseSlices`)。パレットは「スロット順で隣り合う色」の識別性を
 * 検証してあるため、描画順を入れ替えると検証していない色の組み合わせが隣接する
 * (分類別内訳と同じ理由。DESIGN.md 3章)。
 *
 * **色は分類別内訳とパレットを共有するが、割り当ての軸は別**で、同じ色が同じものを指す
 * わけではない。費目名と構成比・金額はカード側の凡例に文字で並ぶので、円の上には数値を
 * 重ねない(こちらも分類別内訳と揃える)。
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
