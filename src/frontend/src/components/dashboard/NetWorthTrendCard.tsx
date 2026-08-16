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
  DEBT_CATEGORY_ID,
  DEBT_LEGEND_SWATCH_BACKGROUND,
  NET_WORTH_TREND_MODES,
  NET_WORTH_TREND_MODE_LABEL,
  PROPERTY_CATEGORY_ID,
  PROPERTY_LEGEND_SWATCH_BACKGROUND,
  PROPERTY_SPREAD_NOT_TOGGLED_NOTICE,
  STACKED_DEBT_NOT_DEDUCTED_NOTICE,
} from "@/constants/dashboard";
import { buildStackedTrend } from "@/lib/dashboard/category-color";

import type { CSSProperties, JSX } from "react";

/**
 * Rechartsは描画にブラウザのAPIを使うため、サーバー側では読み込まない
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
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
 * グラフは**常に資産種別の積み上げ**で、見出しの右の切替が動かすのは**負債を反映するか
 * どうかだけ**(既定はON。docs/screen-requirements-dashboard.md B1「資産推移グラフの
 * 負債反映切替」)。合計を1本の線で描く表示は持たず、その時点の純資産はツールチップの
 * 合計で読む。
 *
 * 切替の状態はURLのクエリに載せる。ローカルstateに閉じ込めると、リンク共有やブラウザの
 * 戻る/進むで同じ表示を再現できない(CODING_STANDARDS.md 2章)。分類軸・表示期間と同じ扱い。
 */
/** 帯の色見本。擬似分類(不動産・負債)は帯と同じ模様にする(DESIGN.md 3章) */
const resolveBandSwatchStyle = (band: NetWorthTrendBand): CSSProperties => {
  if (band.categoryId === DEBT_CATEGORY_ID) {
    return { background: DEBT_LEGEND_SWATCH_BACKGROUND };
  }

  return band.categoryId === PROPERTY_CATEGORY_ID
    ? { background: PROPERTY_LEGEND_SWATCH_BACKGROUND }
    : { backgroundColor: band.color };
};

export const NetWorthTrendCard = ({
  axisName,
  series,
  mode,
  hasSpreadProperty,
  categories,
  buildHref,
}: NetWorthTrendCardProps): JSX.Element => {
  const router = useRouter();

  const { bands, points } = buildStackedTrend(series, categories, mode === "with-debt");

  /*
    切替を出すのは、**表示中の期間のどこかで負債の帯が0でないとき**だけ(同要件B1)。
    押しても何も変わらない切替は、負債を反映していないのか負債を設定していないのかの
    区別を却って曖昧にする。

    **円グラフ・FIRE達成度ゲージが使う`debtTotal`(直近1日の残債)では判定しない。**
    完済した負債は現在の残債が0でも過去の期間には帯が出るため、その条件だと帯を消す手段
    だけが画面から無くなる。円グラフが直近1日しか描かないのに対し、推移グラフは期間全体を
    描くという違いが、そのまま条件の違いになっている。件数で判定しないのも同じ理由で、
    完済して0円の負債だけを参照している分類軸では帯の高さが常に0になる。
  */
  const hasDebtBand = series.some((point) => point.debtBalance !== 0);

  const handleModeChange = (value: string): void => {
    router.replace(buildHref(value as NetWorthTrendModeId));
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-sm">資産推移({axisName})</CardTitle>
        {/*
          資産残高が1件も無いときは切替より空状態を先に出す(同要件B1)。切り替えても
          描くものが無いため、選ばせる意味が無い
        */}
        {series.length > 0 && hasDebtBand ? (
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
              `key`にデータの署名を渡し、分類軸・表示期間・負債反映の切替でデータが
              差し替わったときだけ作り直して登場アニメーションを最初から再生する
              (DESIGN.md 9章)。同じデータのままの再レンダリング(ホバー・リサイズ・
              再取得)では署名が変わらないので再生しない
            */}
            <NetWorthStackedChart
              key={buildNetWorthSeriesKey(axisName, series, mode)}
              bands={bands}
              points={points}
            />

            {/*
              色以外に資産種別を識別する手掛かりが無いので凡例を出す(DESIGN.md 1章・3章)。
              負債の帯は`buildStackedTrend`が末尾に置くので、並びは常に「資産種別 → 負債」
            */}
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {bands.map((band) => (
                <li key={band.categoryId} className="flex items-center gap-2">
                  {/*
                    色は資産種別ごとに実行時に決まる値なので、Tailwindのクラス名では
                    表現できない(ビルド時にクラス名を静的に列挙できないため)。
                    ここだけstyle属性を使う(分類別内訳の凡例と同じ)。
                    負債の見本だけは、帯と同じくハッチングにする(DESIGN.md 3章)
                  */}
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={resolveBandSwatchStyle(band)}
                  />
                  <span>{band.name}</span>
                </li>
              ))}
            </ul>

            {/*
              反映OFFのあいだの注記(同要件B1)。隣の円グラフは負債のスライスと差引後の
              純額を出し続けるので、これが無いと同じ画面の2つのグラフが同じ分類軸について
              違う合計を示しているように見える。出す条件は切替と同じにして、
              切替が出ていないのに「反映していません」とだけ残る状態を作らない
            */}
            {mode === "assets-only" && hasDebtBand ? (
              <p className="text-xs text-muted-foreground">{STACKED_DEBT_NOT_DEDUCTED_NOTICE}</p>
            ) : null}

            {/*
              「資産のみ」でも、利ざやで反映している物件はローン控除後の額のまま積まれる
              (切替が動かすのはB11の負債だけ。同要件B1「負債反映の切替との関係」)。
              0の線より上だけを見て「借入を一切引いていない状態」と読まれないよう注記する。
              出すのは切替を実際に「資産のみ」にしているときだけ — 負債反映のままなら
              引いている額が帯として見えており、読み違えは起きない
            */}
            {mode === "assets-only" && hasSpreadProperty ? (
              <p className="text-xs text-muted-foreground">{PROPERTY_SPREAD_NOT_TOGGLED_NOTICE}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
