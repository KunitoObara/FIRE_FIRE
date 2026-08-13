"use client";

import { Cell, Pie, PieChart } from "recharts";

import styles from "@/components/dashboard/CategoryBreakdownChart.module.css";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  DEBT_SLICE_HATCH_PATTERN_ID,
  PROPERTY_CATEGORY_COLOR,
  PROPERTY_CATEGORY_ID,
  PROPERTY_SLICE_DOT_PATTERN_ID,
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
/** スライスの塗り。擬似分類には模様を重ね、資産種別はスロットの色をそのまま使う */
const resolveSliceFill = (slice: AssetBreakdownSlice): string => {
  if (slice.categoryId === DEBT_CATEGORY_ID) {
    return `url(#${DEBT_SLICE_HATCH_PATTERN_ID})`;
  }

  return slice.categoryId === PROPERTY_CATEGORY_ID
    ? `url(#${PROPERTY_SLICE_DOT_PATTERN_ID})`
    : slice.color;
};

export const CategoryBreakdownChart = ({ slices }: CategoryBreakdownChartProps): JSX.Element => {
  // 分類は増減するマスタデータなので、設定も描画時に組み立てる
  const chartConfig = Object.fromEntries(
    slices.map((slice) => [slice.categoryId, { label: slice.name, color: slice.color }]),
  ) satisfies ChartConfig;

  /*
    **面積は絶対値で取る**(docs/screen-requirements-dashboard.md B1「グラフでの見せ方」)。
    円グラフは正の面積でしか比を表せないが、不動産はオーバーローンで負になりうるため、
    `amount`をそのまま`dataKey`にするとスライスが描かれない。符号は凡例とツールチップの
    金額が持つので、面積用の値だけを別のキーで渡す
  */
  const chartData = slices.map((slice) => ({ ...slice, area: Math.abs(slice.amount) }));

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
          {/*
            不動産の模様は**点**にする(DESIGN.md 3章)。負債と同じ斜線にすると、
            利ざやがマイナスの物件で0の線より下に積まれたときに、色相の違いだけで
            負債と見分けることになる
          */}
          <pattern
            id={PROPERTY_SLICE_DOT_PATTERN_ID}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="4" fill={PROPERTY_CATEGORY_COLOR} />
            <circle cx="1.4" cy="1.4" r="1" fill="var(--card)" fillOpacity="0.55" />
          </pattern>
        </defs>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              hideLabel
              /*
                出す額は面積用の`area`ではなく符号付きの`amount`。オーバーローンの不動産で
                ツールチップだけが正の額を出すと、凡例の符号付きの額と食い違う
              */
              formatter={(_value, _name, item) =>
                formatJpy(Number((item.payload as AssetBreakdownSlice).amount))
              }
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="area"
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
          {chartData.map((slice) => (
            <Cell
              key={slice.categoryId}
              /*
                擬似分類(不動産・負債)だけ模様を重ねる。判定は擬似的な分類IDで行い、
                表示名との一致では見ない — 「不動産」「負債」という名前の資産種別が
                CSVの列名として現れうるため
              */
              fill={resolveSliceFill(slice)}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
