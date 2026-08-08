"use client";

import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_ANIMATION_DURATION_MS, CHART_ANIMATION_EASING } from "@/constants/dashboard";
import { formatJpy } from "@/lib/format/currency";

import type { CSSProperties, JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

/**
 * 分類別内訳の円グラフ(B1)。
 *
 * 分類は登録順に描く。パレットは「スロット順で隣り合う色」の識別性を検証してあるため、
 * 描画順を入れ替えると検証していない色の組み合わせが隣接してしまう
 * (`src/lib/dashboard/category-color.ts`)。
 *
 * 分類名と構成比はカード側の凡例に文字で並ぶため、円の上には数値を重ねない。
 *
 * 登場アニメーション(12時から時計回りのスイープ)は`chart-sweep`クラスのCSSマスクが担う
 * (`src/app/globals.css`。理由もそこに書いてある)。再生の引き金は呼び出し側が渡す`key`で、
 * データが変わったときだけこのコンポーネントが作り直されて最初から再生される。
 */
export const CategoryBreakdownChart = ({ slices }: CategoryBreakdownChartProps): JSX.Element => {
  // 分類は増減するマスタデータなので、設定も描画時に組み立てる
  const chartConfig = Object.fromEntries(
    slices.map((slice) => [slice.categoryId, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer
      config={chartConfig}
      className="chart-sweep aspect-square h-36"
      /*
        再生時間とイージングはCSSではなく定数(`src/constants/dashboard.ts`)を出所にする。
        3つのグラフで同じ値を使う以上、CSSとTypeScriptに同じ数字を二重に持たせない
      */
      style={
        {
          "--chart-anim-duration": `${CHART_ANIMATION_DURATION_MS}ms`,
          "--chart-anim-easing": CHART_ANIMATION_EASING,
        } as CSSProperties
      }
    >
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
          // (ほぼ0度の扇形)のまま止まって円が出ない。スイープは`chart-sweep`のCSSマスクで
          // 行うので、Recharts側のアニメーションは止めたままにする(DESIGN.md 9章)
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
