"use client";

import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  CHART_ANIMATION_DURATION_MS,
  CHART_ANIMATION_EASING,
  DEBT_BAND_HATCH_PATTERN_ID,
  DEBT_CATEGORY_COLOR,
  DEBT_CATEGORY_ID,
  NET_WORTH_STACK_OFFSET,
  NET_WORTH_STACK_TOTAL_LABEL,
} from "@/constants/dashboard";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCompactJpy, formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

import type { ChartConfig } from "@/components/ui/chart";

/** 帯を1つのまとまりとして積むためのID(Rechartsは同じ`stackId`のAreaを積み上げる) */
const STACK_ID = "net-worth";

/**
 * 資産推移グラフの積み上げ表示(B1)。
 *
 * 帯は対象の資産種別で、色と並び順は分類別内訳の円グラフと同じスロット割り当てを共有する
 * (`buildStackedTrend`)。**負債反映ONのときは、対象の負債が0より下の1本の帯として加わる**
 * (docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
 *
 * **正負は分けて積む**(`stackOffset="sign"`)。マイナス残高の資産種別と負債の帯は0より下側に
 * 積まれ、面の上端は「正の帯だけの合計」になる。ツールチップの合計は行に並べた額の総和なので、
 * 上端と一致しないことがある(同節。意図した通り)。
 *
 * 登場アニメーション(左から右へ描き出す)はRechartsに任せる。**全ての帯に同じ時間・
 * 同じイージングを渡す**ことで、1つのクリップで広がるように見せる。帯ごとに時間差を
 * 付けると、途中のフレームで積み上げの合計が実在しない額になる(DESIGN.md 9章)。
 * 再生の引き金は呼び出し側が渡す`key`。
 */
export const NetWorthStackedChart = ({ bands, points }: NetWorthStackedChartProps): JSX.Element => {
  const prefersReducedMotion = usePrefersReducedMotion();

  /*
    資産種別は増減するマスタデータなので、設定も描画時に組み立てる(円グラフと同じ形)。
    ツールチップの行に出る名前と色はここから引かれる
  */
  const chartConfig = Object.fromEntries(
    bands.map((band) => [band.categoryId, { label: band.name, color: band.color }]),
  ) satisfies ChartConfig;

  /*
    ツールチップの行に出す表示名。系列名には`categoryId`を渡しているので、そのままでは
    「その他」の行が`__other__`という擬似的なIDのまま出る
  */
  const bandNames = new Map(bands.map((band) => [band.categoryId, band.name]));

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <AreaChart
        data={points}
        margin={{ left: 8, right: 8, top: 8 }}
        stackOffset={NET_WORTH_STACK_OFFSET}
      >
        {/*
          負債の帯のハッチング(DESIGN.md 3章)。帯は0の線を挟んで資産の帯と隣り合い、
          マイナス残高の資産種別の帯とも並ぶため、色だけでは区別が付かない。
          円グラフの負債スライスと同じ模様・同じ色にし、`<pattern>`のIDだけを分ける
          (同じ画面に2つのSVGが並ぶので、同じIDだとどちらを参照するかがDOMの順序で決まる)
        */}
        <defs>
          <pattern
            id={DEBT_BAND_HATCH_PATTERN_ID}
            width="4"
            height="4"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="4" fill={DEBT_CATEGORY_COLOR} />
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--card)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {/* 目盛りは値を読む補助でしかないため、横線だけを薄く敷く(純資産表示と揃える) */}
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value: string) => format(parseISO(value), "yyyy/MM")}
        />
        {/*
          目盛りの範囲は積み上げた結果で決まるので`dataKey`を渡さない。1系列だった頃と
          同じように渡すと、その1つの帯の額だけで範囲が決まってしまう
        */}
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={formatCompactJpy} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const point: unknown = payload[0]?.payload;
                const date =
                  typeof point === "object" && point !== null && "date" in point
                    ? point.date
                    : undefined;
                const total =
                  typeof point === "object" && point !== null && "total" in point
                    ? point.total
                    : undefined;

                return (
                  <div className="flex flex-col gap-0.5">
                    <span>
                      {typeof date === "string" ? format(parseISO(date), "yyyy年M月") : ""}
                    </span>
                    {/*
                      合計は**行に並べた額の総和**で、負の資産種別も符号のまま加える。
                      負債反映ONのときは負債の行(負の値)も含むので、合計はその時点の
                      純資産そのものになる。OFFのときは負債の行自体が無い(同要件B1)
                    */}
                    {typeof total === "number" ? (
                      <span className="text-xs text-muted-foreground">
                        {NET_WORTH_STACK_TOTAL_LABEL} {formatJpy(total)}
                      </span>
                    ) : null}
                  </div>
                );
              }}
              /*
                既定の行は資産種別名を出すが、金額を`toLocaleString()`で書くため円記号が
                付かない。`formatter`を渡すと行ごと差し替わるので、名前と色見本も自分で描く
                (名前が消えると、8本並ぶ帯のどれの額なのか分からなくなる)
              */
              formatter={(value, name, item) => (
                <>
                  <div
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                    <span className="text-muted-foreground">
                      {bandNames.get(String(name)) ?? name}
                    </span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatJpy(Number(value))}
                    </span>
                  </div>
                </>
              )}
            />
          }
        />
        {bands.map((band) => (
          <Area
            key={band.categoryId}
            /*
              `dataKey`は関数で渡す。`"amounts.現金・預金"`のような文字列パスにすると、
              資産種別名(CSVの列名そのもの)に`.`や`[]`が含まれたときにRechartsの
              パス解決が別の場所を指す。額を平らなキーに展開する案も、`date`・`total`と
              名前が衝突しうるので採らない
            */
            dataKey={(point: NetWorthStackedPoint) => point.amounts[band.categoryId] ?? 0}
            name={band.categoryId}
            stackId={STACK_ID}
            type="monotone"
            stroke={band.color}
            strokeWidth={1.5}
            // 負債の帯だけ、色ではなくハッチングの`<pattern>`で塗る
            fill={
              band.categoryId === DEBT_CATEGORY_ID
                ? `url(#${DEBT_BAND_HATCH_PATTERN_ID})`
                : band.color
            }
            fillOpacity={0.85}
            // 点が60個並ぶと丸が潰れて帯の境界が読めなくなる。ホバー時だけ位置を示す
            dot={false}
            activeDot={{ r: 3 }}
            // 視差効果を減らす設定では最終状態を即座に描く(DESIGN.md 9章)
            isAnimationActive={!prefersReducedMotion}
            animationDuration={CHART_ANIMATION_DURATION_MS}
            animationEasing={CHART_ANIMATION_EASING}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
};
