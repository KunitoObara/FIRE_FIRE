"use client";

import dynamic from "next/dynamic";

import { RiskLevelIndicator } from "@/components/assumptions/RiskLevelIndicator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BREAKDOWN_NET_AMOUNT_LABEL,
  BREAKDOWN_NET_AMOUNT_WITH_PROPERTY_LABEL,
  buildBreakdownKey,
  DASHBOARD_EMPTY_STATES,
  DEBT_CATEGORY_ID,
  DEBT_LEGEND_SWATCH_BACKGROUND,
  PROPERTY_CATEGORY_ID,
  PROPERTY_LEGEND_SWATCH_BACKGROUND,
  RISK_LEVEL_LEGEND_LABEL,
} from "@/constants/dashboard";
import { formatJpy, formatPercent } from "@/lib/format/currency";

import type { CSSProperties, JSX } from "react";

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
/** 凡例の色見本。擬似分類(不動産・負債)は模様付き、資産種別はスロットの色そのまま */
const resolveLegendSwatchStyle = (slice: AssetBreakdownSlice): CSSProperties => {
  if (slice.categoryId === DEBT_CATEGORY_ID) {
    return { backgroundImage: DEBT_LEGEND_SWATCH_BACKGROUND };
  }

  return slice.categoryId === PROPERTY_CATEGORY_ID
    ? { background: PROPERTY_LEGEND_SWATCH_BACKGROUND }
    : { backgroundColor: slice.color };
};

export const CategoryBreakdownCard = ({
  axisName,
  slices,
  netAmount,
}: CategoryBreakdownCardProps): JSX.Element => (
  /*
    `Card`は既定で`overflow-hidden`(角丸をクリップするため)。ここでは上書きする —
    円グラフのツールチップ(Rechartsが同じdiv内に絶対配置で描くHTML。ポータル外)が
    カードの境界にかかると、`overflow-hidden`のせいでツールチップの一部が見えなくなる
    (Trelloカード Y-01「円グラフのツールチップが隠れる」)。このカードの中身はグラフと
    凡例だけで、角丸のクリップに頼る画像等が無いため、ここだけ`overflow-visible`にしても
    見た目に副作用が無い。
  */
  <Card className="overflow-visible">
    <CardHeader>
      <CardTitle className="text-sm">分類別内訳({axisName})</CardTitle>
    </CardHeader>
    <CardContent>
      {slices.length === 0 ? (
        <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.breakdown} />
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            擬似分類(不動産・負債)のスライスを置くと構成比の分母が各スライスの絶対値の
            合計に変わり、%が純資産に対する割合ではなくなる。どちらかを含む分類軸でだけ
            純額を数字で併記して、そのことが分かるようにする(同要件B1)。
            見出しは式の順に出す(不動産を含む軸では「資産 + 不動産 - 負債」)
          */}
          {netAmount !== null ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs text-muted-foreground">
                {slices.some((slice) => slice.categoryId === PROPERTY_CATEGORY_ID)
                  ? BREAKDOWN_NET_AMOUNT_WITH_PROPERTY_LABEL
                  : BREAKDOWN_NET_AMOUNT_LABEL}
              </span>
              <span className="font-semibold tabular-nums">{formatJpy(netAmount)}</span>
              <span className="text-xs text-muted-foreground">
                (構成比の分母は各分類の絶対値の合計です)
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
                    /*
                      擬似分類の色見本は円グラフのスライスと同じ模様にする(見本とスライスの
                      見た目が違うと対応が取れない。DESIGN.md 3章)。負債は斜線、不動産は点
                    */
                    style={resolveLegendSwatchStyle(slice)}
                  />
                  <span>{slice.name}</span>
                  {/*
                    B9で置いたリスクレベル(同要件B1「リスクの可視化」)。形状と文字はB9と
                    同じものを使い、**色だけは当てない** — この行には分類のスロット色が既に
                    並んでおり、低リスクの`--chart-1`は分類側の色と同じ値になるため、
                    同じ行で2種類の意味の色を読み分けられない。
                    未設定の資産種別と擬似分類には`null`が入っていて何も出ない
                  */}
                  {slice.riskLevel !== null ? (
                    /*
                      `RiskLevelIndicator`のルートは`display: flex`なので、包む側も
                      `inline-flex`にする。既定の`display: inline`のままだとインラインの中に
                      ブロックレベルの箱を抱えることになり、凡例の行が折り返しうる
                      (HTMLモック b1-dashboard.html のバッジと同じ組み方)
                    */
                    <span className="inline-flex items-center text-xs text-muted-foreground">
                      <span className="sr-only">{RISK_LEVEL_LEGEND_LABEL}</span>
                      <RiskLevelIndicator level={slice.riskLevel} colored={false} />
                    </span>
                  ) : null}
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
