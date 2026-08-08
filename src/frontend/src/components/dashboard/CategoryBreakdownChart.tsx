"use client";

import { Cell, Pie, PieChart } from "recharts";

import styles from "@/components/dashboard/CategoryBreakdownChart.module.css";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  DEBT_SLICE_HATCH_PATTERN_ID,
} from "@/constants/dashboard";
import { formatJpy } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

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
 * 登場アニメーション(12時から時計回りのスイープ)はCSSマスクが担う
 * (`CategoryBreakdownChart.module.css`。理由もそこに書いてある)。再生の引き金は
 * 呼び出し側が渡す`key`で、データが変わったときだけこのコンポーネントが作り直されて
 * 最初から再生される。
 */
export const CategoryBreakdownChart = ({ slices }: CategoryBreakdownChartProps): JSX.Element => {
  // 分類は増減するマスタデータなので、設定も描画時に組み立てる
  const chartConfig = Object.fromEntries(
    slices.map((slice) => [slice.categoryId, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={cn(styles.chartSweep, "aspect-square h-36")}>
      <PieChart>
        {/*
          負債のスライスに重ねるハッチング(斜線)。**隣り合うスライスの色相にかかわらず
          常に重ねる**(DESIGN.md 3章)。負債は最後のスライスなので12時の位置で1色目と必ず
          隣り合うが、そこに何色が来るかは分類軸ごとの登録順で決まり、`--chart-*`の値も
          後から調整されうる。凡例の色見本にも同じ斜線を出す(`CategoryBreakdownCard`)
        */}
        <defs>
          <pattern
            id={DEBT_SLICE_HATCH_PATTERN_ID}
            width="4"
            height="4"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="4" fill={DEBT_CATEGORY_COLOR} />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--card)" strokeWidth="1.5" />
          </pattern>
        </defs>
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
          // (ほぼ0度の扇形)のまま止まって円が出ない。スイープは`CategoryBreakdownChart.module.css`
          // のCSSマスクで行うので、Recharts側のアニメーションは止めたままにする(DESIGN.md 9章)
          isAnimationActive={false}
        >
          {slices.map((slice) => (
            <Cell
              key={slice.categoryId}
              fill={
                slice.categoryId === DEBT_CATEGORY_ID
                  ? `url(#${DEBT_SLICE_HATCH_PATTERN_ID})`
                  : slice.color
              }
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
