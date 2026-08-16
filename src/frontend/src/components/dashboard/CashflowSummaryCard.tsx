"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildCashflowEmptyState,
  buildExpenseBreakdownKey,
  CASHFLOW_DATA_QUERY_KEY,
  CASHFLOW_DATA_STALE_TIME_MS,
  CASHFLOW_DETAIL_LINK,
  DASHBOARD_RETRY_LABEL,
  DASHBOARD_RETRYING_LABEL,
  NO_EXPENSE_IN_MONTH_LABEL,
} from "@/constants/dashboard";
import { fetchCashflowData } from "@/lib/dashboard/cashflow-data";
import { buildExpenseSlices } from "@/lib/dashboard/expense-color";
import { resolveFailureView } from "@/lib/dashboard/failure-view";
import { formatMonthLabel } from "@/lib/dashboard/month";
import { formatJpy, formatPercent, formatSignedJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * Rechartsは描画にブラウザのAPIを使うため、サーバー側では読み込まない
 * (src/frontend/docs/CODING_STANDARDS.md 2章。分類別内訳の円グラフと同じ扱い)。
 */
const ExpenseBreakdownChart = dynamic(
  async () => (await import("@/components/dashboard/ExpenseBreakdownChart")).ExpenseBreakdownChart,
  { ssr: false, loading: () => <Skeleton className="size-36 rounded-full" /> },
);

/**
 * 収支サマリのカード(B1)。
 *
 * 対象の月は**カードの中の年月ピッカー**で選ぶ(既定は当月。
 * docs/screen-requirements-dashboard.md B1「年月の選択」)。分類軸切替セレクタ・表示期間切替の
 * 影響は受けない — 入出金明細の集計であり、資産の分類軸とは別の軸のため。
 *
 * **取引の取得をこのカードが持つ。** ダッシュボードの一括取得(`fetchDashboardData`)に混ぜると、
 * 年月を切り替えるたびに資産残高・分類軸・負債・FIRE目標まで読み直すことになる。キャッシュは
 * 月ごとに分かれるので、一度見た月へ戻ったときは読み直さない。
 *
 * そのため**このカードだけが取得に失敗しうる**。読み込み中・失敗(再試行)・空を別の表示にする
 * (同要件「選択した年月にデータが無いとき」)。失敗を空状態として見せると、データはあるのに
 * 「ありません」と読める表示になり、次にすべきことが正反対になる。
 *
 * 収支の符号はプラスを`--success`、マイナスを`--destructive`で示すが、
 * 色だけに意味を持たせないよう金額側にも必ず符号を付ける(`formatSignedJpy`)。
 */
export const CashflowSummaryCard = ({
  month,
  maxMonth,
  onMonthChange,
}: CashflowSummaryCardProps): JSX.Element => {
  const cashflowQuery = useQuery({
    /*
      対象月をキーに含めるので、切り替えると読み直す代わりに戻ってきたときは即座に出せる。
      B2の取込完了時は`CASHFLOW_DATA_QUERY_KEY`(前方一致)で無効化されるため、どの月で
      見ていたキャッシュも一度に落ちる(B3が期間ごとに分けているのと同じ形)
    */
    queryKey: [...CASHFLOW_DATA_QUERY_KEY, month],
    queryFn: () => fetchCashflowData(month),
    /*
      戻ってきた月は**読み直さない**(同要件B1「年月の選択」)。既定の`staleTime: 0`だと
      キャッシュを出したうえで裏で取り直すため、月を行き来するたびにFirestoreを読むことになる。
      B2の取込後は前方一致の無効化が`staleTime`より優先されるので、古い数字は残らない
    */
    staleTime: CASHFLOW_DATA_STALE_TIME_MS,
    // `fetchCashflowData`はFirestoreの失敗を`ok: false`として解決させるので、例外は集計が
    // 壊れたデータで落ちたときだけ。同じ入力で繰り返しても結果は変わらない(B1・B3と同じ扱い)
    retry: false,
  });

  const result = cashflowQuery.data;
  // 取得前(`undefined`)と失敗を区別する必要があるので、真偽値の比較で判定する
  const failureReason = result !== undefined && !result.ok ? result.reason : null;
  const unexpectedError = cashflowQuery.error;
  const failureView = resolveFailureView(failureReason, unexpectedError);
  const cashflow = result?.ok === true ? result.cashflow : null;

  // 画面の文言は原因まで特定できないので、開発者向けの手掛かりだけコンソールに残す
  useEffect(() => {
    if (unexpectedError) {
      console.error("収支サマリを組み立てられませんでした", unexpectedError);
    }
  }, [unexpectedError]);

  const balance = cashflow === null ? 0 : cashflow.income - cashflow.expense;
  /*
    費目別支出の色は**費目名の順**に割り当てる(同要件B1「費目別支出の円グラフ」)。
    費目マスタを持たない方針のため、資産分類のような登録順がそもそも無い
  */
  const expenseSlices = buildExpenseSlices(cashflow?.expenseByCategory ?? []);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm">収支サマリ</CardTitle>
          <MonthPicker month={month} maxMonth={maxMonth} onSelect={onMonthChange} />
        </div>
        <CardAction className="self-center">
          {/*
            選択中の年月は引き継がない(同要件B1「遷移条件」)。B3の期間絞り込みは
            「直近1ヶ月/3ヶ月/今年/全期間」で、特定の月を指す選択肢を持たないため
          */}
          <Link
            href={CASHFLOW_DETAIL_LINK.href}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {CASHFLOW_DETAIL_LINK.label}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {cashflowQuery.isPending ? <Skeleton className="h-24 w-full" /> : null}

        {/* 失敗は失敗として出す。データはあるのに「ありません」と読める表示にしない */}
        {failureView ? (
          <div className="flex flex-col items-start gap-3">
            {/* 読み上げの対象は文言だけにする。ボタンを含めない扱いは画面全体の失敗表示と同じ */}
            <p role="alert" className="text-sm text-destructive">
              {failureView.message}
            </p>
            {/* 年月ごとの取得なので、再試行の導線もこのカードの中に要る */}
            {failureView.retryable ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cashflowQuery.isFetching}
                onClick={() => {
                  void cashflowQuery.refetch();
                }}
              >
                {cashflowQuery.isFetching ? DASHBOARD_RETRYING_LABEL : DASHBOARD_RETRY_LABEL}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/*
          選択した月に取引が1件も無ければ空状態。月初や取り込んでいない過去の月では正常に
          起こるのでエラーとしては扱わない。失敗を出しているあいだは出さない
        */}
        {!cashflowQuery.isPending && failureView === null && cashflow === null ? (
          <DashboardEmptyState {...buildCashflowEmptyState(formatMonthLabel(month))} />
        ) : null}

        {cashflow !== null && failureView === null ? (
          <dl className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">収入</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatJpy(cashflow.income)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">支出</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatJpy(cashflow.expense)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">収支</dt>
              <dd
                className={
                  balance < 0
                    ? "text-lg font-semibold text-destructive tabular-nums"
                    : "text-lg font-semibold text-success tabular-nums"
                }
              >
                {formatSignedJpy(balance)}
              </dd>
            </div>
          </dl>
        ) : null}

        {/*
          費目別支出は大項目で集計し(docs/transaction-import-requirements.md 6章)、円グラフと
          凡例で出す。凡例の色見本・費目名・構成比・金額という並びは分類別内訳カードと同じで、
          同じ画面に並ぶ2枚のカードで読み方を覚え直さずに済むようにしている(同要件B1)。

          **支出が1件も無い月は空状態にしない** — 全額が振替・計算対象外だった月に普通に
          起こる状態で、上の3つの数字は出したまま円グラフの場所にその旨を出す。空欄のまま
          詰めると、支出が無いのか表示が壊れているのかを画面から区別できない(同要件B1)
        */}
        {cashflow !== null && failureView === null ? (
          <div className="flex flex-wrap items-center gap-6">
            {expenseSlices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{NO_EXPENSE_IN_MONTH_LABEL}</p>
            ) : (
              <>
                {/*
                  `key`にデータの署名を渡し、対象月やデータが差し替わったときだけ作り直して
                  スイープを最初から再生する(分類別内訳と同じ扱い。DESIGN.md 9章)。
                  凡例の構成比・金額はアニメーションさせないので、作り直しの対象に含めない
                */}
                <ExpenseBreakdownChart
                  key={buildExpenseBreakdownKey(month, expenseSlices)}
                  slices={expenseSlices}
                />
                <ul className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
                  {expenseSlices.map((slice) => (
                    <li key={slice.categoryId} className="flex items-center gap-2">
                      {/*
                        色は費目ごとに実行時に決まる値なので、Tailwindのクラス名では表現できない
                        (ビルド時にクラス名を静的に列挙できないため)。ここだけstyle属性を使う
                      */}
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span>{slice.name}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums">
                        {formatPercent(slice.ratio)}
                      </span>
                      <span className="w-28 text-right text-muted-foreground tabular-nums">
                        {formatJpy(slice.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
