"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo } from "react";

import { CashflowSummaryCard } from "@/components/dashboard/CashflowSummaryCard";
import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DebtSummaryCard } from "@/components/dashboard/DebtSummaryCard";
import { FireProgressCard } from "@/components/dashboard/FireProgressCard";
import { NetWorthTrendCard } from "@/components/dashboard/NetWorthTrendCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_DATA_QUERY_KEY,
  DASHBOARD_FAILURE_MESSAGES,
  DASHBOARD_RETRY_LABEL,
  DASHBOARD_RETRYING_LABEL,
  DASHBOARD_UNEXPECTED_ERROR_MESSAGE,
  NO_ASSET_AXIS_EMPTY_STATE,
  NO_CSV_IMPORT_LABEL,
} from "@/constants/dashboard";
import { resolveAxisNetAmount } from "@/lib/dashboard/aggregation";
import { buildBreakdownSlices } from "@/lib/dashboard/category-color";
import { fetchDashboardData } from "@/lib/dashboard/dashboard-data";
import {
  buildDashboardHref,
  resolveAxisId,
  resolvePeriodId,
  resolveTrendModeId,
} from "@/lib/dashboard/filters";
import { filterSeriesByPeriod } from "@/lib/dashboard/period";

import type { JSX } from "react";

/**
 * 表示できないときの扱いを決める。取得の失敗(理由つき)と、集計まで含めた例外の両方をここに集める。
 * 表示できているあいだは`null`。
 *
 * 文言と再試行の可否を**同じ場所で**決める。別々に判断すると、失敗理由を足したときに
 * 片方だけ直して、文言は「ログインし直してください」なのに再試行ボタンが出る、といった
 * 食い違いが起きる。
 *
 * **例外を先に見る。** rejectしたときTanStack Queryは`data`を更新しないので、`ok: false`で
 * 失敗したあとに再試行が例外で落ちると、`failureReason`には1つ前の理由が残ったままになる。
 * 理由を先に見ると、その古い文言を出し続けてしまう。
 */
const resolveFailureView = (
  failureReason: FirestoreAccessFailureReason | null,
  unexpectedError: unknown,
): DashboardFailureView | null => {
  if (unexpectedError) {
    return { message: DASHBOARD_UNEXPECTED_ERROR_MESSAGE, retryable: true };
  }

  if (failureReason === null) {
    return null;
  }

  return {
    message: DASHBOARD_FAILURE_MESSAGES[failureReason],
    /*
      ログイン切れ・設定不備は再取得しても同じ結果にしかならず、文言で案内している
      「ログインし直す」より先にボタンを押させてしまう。押せる導線は残さない。
      `permission-denied`は文言で再ログインを促してはいるが、IDトークンが更新されれば
      その場で通ることがあるので残す(`unknown`と同じ扱い)。
    */
    retryable: failureReason !== "signed-out" && failureReason !== "configuration-error",
  };
};

/** 直近CSV取込日時の表示。未取込のときは日時の代わりにその旨を出す */
const formatLastImportedAt = (isoDateTime: string | null): string =>
  isoDateTime ? format(parseISO(isoDateTime), "yyyy/MM/dd HH:mm") : NO_CSV_IMPORT_LABEL;

/**
 * B1 ダッシュボード画面の本体(docs/screen-requirements-dashboard.md B1)。
 *
 * B2 CSV取込・B4 資産分類マスタ・B8 FIRE目標がFirestoreへ書いたデータを読んで表示する。
 * 取得がブラウザ側のFirebase SDK頼み(サーバー側から`uid`を特定できない)なので、
 * 画面本体をClient Componentにしている。B4・B5と同じ理由・同じ構成。
 *
 * 分類軸の切り替えは資産推移グラフと分類別内訳の両方に及ぶ(同要件B1)。切り替えのたびに
 * Firestoreを引き直さず、1度読んだ資産残高を分類軸ごとに集計した結果から選ぶだけにしている。
 */
export const DashboardScreen = ({
  axisParam,
  periodParam,
  debtParam,
}: DashboardScreenProps): JSX.Element => {
  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_DATA_QUERY_KEY,
    queryFn: fetchDashboardData,
    /*
      自動リトライはしない。`fetchDashboardData`はFirestoreの失敗を`ok: false`として
      「解決」させるので、ここへ例外が届くのは集計が壊れたデータで落ちたときだけ。
      同じ入力で何度やっても同じ例外になり、既定の3回(指数バックオフ)は原因の分からない
      スケルトンを数秒延ばして読み取りを4倍にするだけになる。やり直しは再試行ボタンに委ねる
    */
    retry: false,
  });

  // 期間の絞り込みの基準時刻。レンダーのたびに進むと同じ表示が揺れるため1度だけ決める
  const now = useMemo(() => new Date(), []);

  const result = dashboardQuery.data;
  const data = result?.ok ? result.data : null;
  // 失敗の判定だけは真偽値の比較で行う。取得前(`undefined`)と失敗を区別する必要があるため
  const failureReason = result !== undefined && !result.ok ? result.reason : null;
  const axes = data?.axes ?? [];

  /**
   * 取得が例外で落ちた場合は結果そのものが無い(`ok: false`にもならない)。
   * Firestoreを引く処理は理由付きの失敗を返すが、その後の集計は各リポジトリの
   * try/catchの外で走るため、日付が壊れたドキュメントが1件混じるだけでここへ来る。
   */
  const unexpectedError = dashboardQuery.error;

  const failureView = resolveFailureView(failureReason, unexpectedError);

  // 画面の文言は原因まで特定できないので、開発者向けの手掛かりだけコンソールに残す
  useEffect(() => {
    if (unexpectedError) {
      console.error("ダッシュボードの表示データを組み立てられませんでした", unexpectedError);
    }
  }, [unexpectedError]);

  const selectedAxisId = resolveAxisId(axisParam, axes);
  const selectedPeriodId = resolvePeriodId(periodParam);
  const selectedTrendMode = resolveTrendModeId(debtParam);
  const selectedAxis = axes.find((axis) => axis.id === selectedAxisId);
  const axisData = selectedAxisId ? data?.byAxis[selectedAxisId] : undefined;

  const series = filterSeriesByPeriod(axisData?.netWorthSeries ?? [], selectedPeriodId, now);
  const debtTotal = axisData?.debtTotal ?? 0;
  const slices = buildBreakdownSlices(axisData?.breakdown ?? [], data?.categories ?? [], debtTotal);
  /*
    差引後の純額は負債を含む分類軸でだけ併記する(同要件B1)。含まない軸では構成比の分母が
    資産合計そのものなので、断り書きを添える意味が無い。0円の負債はスライスも出ないため
    `debtTotal`が0のときは`null`になり、断り書きだけが残る状態にはならない。

    絞り込み後の`series`ではなく`axisData`を渡す。純額は「いま何をどれだけ持っているか」を
    表す内訳の相手なので、表示期間ではなく直近の資産残高で出す(`resolveAxisNetAmount`)
  */
  const netAmount = resolveAxisNetAmount(axisData);

  return (
    <>
      <DashboardFilters
        axes={axes}
        selectedAxisId={selectedAxisId ?? ""}
        selectedPeriodId={selectedPeriodId}
        selectedTrendMode={selectedTrendMode}
      />

      {dashboardQuery.isPending ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-60 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        </div>
      ) : null}

      {failureView ? (
        <div className="flex flex-col items-start gap-3">
          {/* 読み上げの対象は文言だけにする。ボタンを含めない扱いは既存画面と同じ */}
          <p role="alert" className="text-sm text-destructive">
            {failureView.message}
          </p>
          {/* リロードしか手が無い状態にしない。一時的な失敗ならこの場で回復できる */}
          {failureView.retryable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dashboardQuery.isFetching}
              onClick={() => {
                void dashboardQuery.refetch();
              }}
            >
              {dashboardQuery.isFetching ? DASHBOARD_RETRYING_LABEL : DASHBOARD_RETRY_LABEL}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/*
        失敗を出しているあいだは中身を出さない。例外で落ちた再取得では直前の成功データが
        残る(TanStack Query)ので、条件を`data`だけにするとエラーの真下に古い金額が並ぶ。
        `ok: false`では結果ごと置き換わって消えるので、そちらと扱いを揃える
      */}
      {data && failureView === null ? (
        <>
          <p className="text-xs text-muted-foreground">
            直近CSV取込:{" "}
            <span className="tabular-nums">{formatLastImportedAt(data.lastImportedAt)}</span>
          </p>

          {selectedAxis ? (
            <NetWorthTrendCard
              axisName={selectedAxis.name}
              series={series}
              mode={selectedTrendMode}
              /*
                色スロットの割り当ては分類別内訳と共有する。同じ画面の2つのグラフで同じ
                資産種別が違う色になると見比べられない(同要件B1「積み上げ表示」)
              */
              categories={data.categories}
              buildHref={(mode) => buildDashboardHref(selectedAxisId, selectedPeriodId, mode)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">資産の表示</CardTitle>
              </CardHeader>
              <CardContent>
                <DashboardEmptyState {...NO_ASSET_AXIS_EMPTY_STATE} />
              </CardContent>
            </Card>
          )}

          {/*
            FIRE達成度の現在資産額はB8で設定した対象分類で集計しており、この画面の分類軸切替
            セレクタには追従しない(同要件B1)。分類軸が未登録でも隠さず、内訳の空状態と
            並べて出す(対象分類が未設定なら総資産で計算できる)
          */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {selectedAxis ? (
              <CategoryBreakdownCard
                axisName={selectedAxis.name}
                slices={slices}
                netAmount={netAmount}
              />
            ) : null}
            <FireProgressCard fireProgress={data.fireProgress} />
          </div>

          {/*
            負債サマリは分類軸切替セレクタの影響を受けない。分類軸で絞ると、負債を集計対象に
            選んでいない軸を表示中に「登録したはずの負債が消える」ことになる(同要件B1)
          */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DebtSummaryCard debts={data.debts} />
            <CashflowSummaryCard cashflow={data.cashflow} />
          </div>
        </>
      ) : null}
    </>
  );
};
