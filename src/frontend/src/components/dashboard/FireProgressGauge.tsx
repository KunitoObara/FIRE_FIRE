"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { FIRE_GAUGE_ANIMATION_KEY } from "@/constants/dashboard";
import { useAnimatedProgress } from "@/hooks/use-animated-progress";
import { toDisplayAchievementRate, toGaugeRatio } from "@/lib/dashboard/fire-progress";
import { formatPercent } from "@/lib/format/currency";

import type { JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  rate: { label: "達成率", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * FIRE達成度ゲージ(B1)。
 *
 * 塗りは0〜100%で止める。中央に出す数値は**超過側だけ**実際の達成率をそのまま出す。
 * 目標を超えている場合に「100%」としか出ないと、超過分が見えなくなるため
 * (`src/lib/dashboard/fire-progress.ts`)。
 *
 * **負の達成率(負債が資産を上回る場合)は0%に丸める。** リングは0で止まるので、
 * 数値だけ`-18%`を出すと同じ瞬間に2つの違う達成率が画面に出る(DESIGN.md 9章)。
 * 丸めるのは達成率だけで、現在資産額の金額はカード側がマイナスのまま出す。
 *
 * **リングと中央の%は同じ進捗値から描く**(DESIGN.md 9章)。リングをRechartsの
 * アニメーション、数値を自前のカウントアップ、と別々の仕組みに分けると、同じ600msでも
 * イージングの実装差で途中の進み方がずれ、同じ瞬間に2つの違う達成率が画面に出る。
 * そのためRecharts側のアニメーションは止めたまま(`isAnimationActive={false}`)にして、
 * 描画する値そのものを`useAnimatedProgress`で動かしている。
 *
 * **再生するのは初回描画時だけ**(DESIGN.md 9章の再生条件)。分類軸・表示期間の切替で
 * 再生しないのはもちろん、画面を開いたまま裏で取り直しが走って達成率が変わった場合にも
 * 再生しない。そのため進捗の引き金には達成率ではなく固定値を渡している。
 *
 * 金額(目標資産額・現在資産額)はカウントアップさせない。桁の多い金額が途中の値で
 * 読めてしまうと、桁の読み違いをこちらから作ることになる(DESIGN.md 1章)。
 */
export const FireProgressGauge = ({ achievementRate }: FireProgressGaugeProps): JSX.Element => {
  const progress = useAnimatedProgress(FIRE_GAUGE_ANIMATION_KEY);
  const animatedRate = achievementRate * progress;

  return (
    <div className="relative h-36 w-36 shrink-0">
      <ChartContainer config={chartConfig} className="h-36 w-36">
        <RadialBarChart
          data={[{ name: "rate", value: toGaugeRatio(animatedRate) * 100 }]}
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
            // 伸びる動きは`value`そのものが担う。ここを有効にすると、値の更新のたびに
            // Rechartsが独自の補間を重ねて中央の%と進み方がずれる
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ChartContainer>
      <p
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums"
      >
        {formatPercent(toDisplayAchievementRate(animatedRate))}
      </p>
    </div>
  );
};
