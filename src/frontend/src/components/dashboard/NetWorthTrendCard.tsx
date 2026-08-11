"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildNetWorthSeriesKey,
  DASHBOARD_EMPTY_STATES,
  NET_WORTH_TREND_MODES,
  NET_WORTH_TREND_MODE_LABEL,
  STACKED_DEBT_NOT_DEDUCTED_NOTICE,
} from "@/constants/dashboard";
import { buildStackedTrend } from "@/lib/dashboard/category-color";

import type { JSX } from "react";

/**
 * Rechartsは描画にブラウザのAPIを使うため、サーバー側では読み込まない
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
const NetWorthTrendChart = dynamic(
  async () => (await import("@/components/dashboard/NetWorthTrendChart")).NetWorthTrendChart,
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
);

const NetWorthStackedChart = dynamic(
  async () => (await import("@/components/dashboard/NetWorthStackedChart")).NetWorthStackedChart,
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> },
);

/**
 * 資産推移グラフのカード(B1)。
 *
 * 見出しに分類軸の名前を入れる。推移は選択中の分類軸で集計した金額なので、
 * 「総資産推移」と固定で名乗ると投資性資産などを選んだときに中身と食い違う。
 *
 * 表示は積み上げと純資産の2つで、見出しの右の切替で行き来する(既定は積み上げ)。
 * 積み上げの上端は正の資産種別だけの合計で純資産ではないため、差し引いた推移を見る場所を
 * 別に用意している(docs/screen-requirements-dashboard.md B1「資産推移グラフの表示切替」)。
 *
 * 切替の状態はURLのクエリに載せる。ローカルstateに閉じ込めると、リンク共有やブラウザの
 * 戻る/進むで同じ表示を再現できない(CODING_STANDARDS.md 2章)。分類軸・表示期間と同じ扱い。
 */
export const NetWorthTrendCard = ({
  axisName,
  series,
  mode,
  categories,
  debtTotal,
  buildHref,
}: NetWorthTrendCardProps): JSX.Element => {
  const router = useRouter();

  const { bands, points } = buildStackedTrend(series, categories);

  const handleModeChange = (value: string): void => {
    router.replace(buildHref(value as NetWorthTrendModeId));
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-sm">資産推移({axisName})</CardTitle>
        {/*
          資産残高が1件も無いときは切替より空状態を先に出す(同要件B1)。切り替えても
          どちらの表示も描くものが無いため、選ばせる意味が無い
        */}
        {series.length > 0 ? (
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList aria-label={NET_WORTH_TREND_MODE_LABEL}>
              {NET_WORTH_TREND_MODES.map((trendMode) => (
                <TabsTrigger key={trendMode.id} value={trendMode.id}>
                  {trendMode.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.netWorth} />
        ) : (
          <div className="flex flex-col gap-3">
            {/*
              `key`にデータの署名を渡し、分類軸・表示期間・表示切替でデータが差し替わった
              ときだけ作り直して登場アニメーションを最初から再生する(DESIGN.md 9章)。
              同じデータのままの再レンダリング(ホバー・リサイズ・再取得)では署名が
              変わらないので再生しない
            */}
            {mode === "stacked" ? (
              <NetWorthStackedChart
                key={buildNetWorthSeriesKey(axisName, series, mode)}
                bands={bands}
                points={points}
              />
            ) : (
              <NetWorthTrendChart
                key={buildNetWorthSeriesKey(axisName, series, mode)}
                axisName={axisName}
                series={series}
              />
            )}

            {/*
              1本の線だったときと違い、色以外に資産種別を識別する手掛かりが無いので凡例を
              出す(DESIGN.md 1章・3章)。純資産表示は1系列なので凡例を置かない
            */}
            {mode === "stacked" ? (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {bands.map((band) => (
                  <li key={band.categoryId} className="flex items-center gap-2">
                    {/*
                      色は資産種別ごとに実行時に決まる値なので、Tailwindのクラス名では
                      表現できない(ビルド時にクラス名を静的に列挙できないため)。
                      ここだけstyle属性を使う(分類別内訳の凡例と同じ)
                    */}
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: band.color }}
                    />
                    <span>{band.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/*
              負債を含む分類軸を積み上げで表示しているあいだの注記(同要件B1)。隣の円グラフは
              負債のスライスと差引後の純額を出しているので、これが無いと同じ画面の2つの
              グラフが同じ分類軸について違う合計を示しているように見える。
              残債の合計が0円のときは出さない(円グラフが0円の負債スライスを出さないのと同じ)
            */}
            {mode === "stacked" && debtTotal > 0 ? (
              <p className="text-xs text-muted-foreground">{STACKED_DEBT_NOT_DEDUCTED_NOTICE}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
