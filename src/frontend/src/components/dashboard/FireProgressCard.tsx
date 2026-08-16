"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACHIEVEMENT_AXIS_MISSING_NOTICE,
  ASSUMPTION_SETTINGS_LINK,
  DASHBOARD_EMPTY_STATES,
  FIRE_GOAL_LINK,
  MONTHLY_CONTRIBUTION_LINK_LABEL,
  NEGATIVE_CURRENT_AMOUNT_NOTICE,
  UNREACHABLE_PROJECTION_NOTICE,
} from "@/constants/dashboard";
import { calculateAchievementRate, formatFireProjection } from "@/lib/dashboard/fire-progress";
import { formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

const FireProgressGauge = dynamic(
  async () => (await import("@/components/dashboard/FireProgressGauge")).FireProgressGauge,
  { ssr: false, loading: () => <Skeleton className="size-36 rounded-full" /> },
);

/**
 * FIRE達成度ゲージのカード(B1)。
 *
 * 達成率が求まらない(目標資産額が未設定・0以下)場合は、ゲージを出さずに
 * B8 FIRE目標設定画面への導線だけを出す。
 *
 * 現在資産額には**対象分類名を併記する**(docs/screen-requirements-dashboard.md B1)。
 * この数字はB8で設定した対象分類で集計しており、同じ画面の分類軸切替セレクタには
 * 追従しない。併記しないと、セレクタが別の分類軸を指しているときにゲージの数字が
 * どちらのものか判別できない。
 */
export const FireProgressCard = ({ fireProgress }: FireProgressCardProps): JSX.Element => {
  const achievementRate =
    fireProgress === null
      ? null
      : calculateAchievementRate(fireProgress.currentAmount, fireProgress.targetAmount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">FIRE達成度</CardTitle>
        <CardAction>
          <Link
            href={FIRE_GOAL_LINK.href}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {FIRE_GOAL_LINK.label}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {fireProgress === null || achievementRate === null ? (
          <DashboardEmptyState {...DASHBOARD_EMPTY_STATES.fireProgress} />
        ) : (
          <div className="flex flex-col gap-3">
            {/*
              対象分類がB4で削除されていた場合は、既定(総資産)で計算したうえでその旨を出す。
              ゲージを消したり0%にしたりはしない(同要件B1)。設定し直す先はB8で、
              カード見出しの「目標を設定する」がそのまま導線になるのでリンクは重ねない
            */}
            {fireProgress.achievementAxisMissing ? (
              <p role="status" className="text-xs text-destructive">
                {ACHIEVEMENT_AXIS_MISSING_NOTICE}
              </p>
            ) : null}

            {/*
              負債が資産を上回ると現在資産額がマイナスになり、達成率は0%に丸めて表示する
              (docs/screen-requirements-dashboard.md B1)。0%は「まだ何も貯まっていない」
              状態でも出る値なので、丸めたことをここで明示しないと両者を区別できない
            */}
            {fireProgress.currentAmount < 0 ? (
              <p role="status" className="text-xs text-destructive">
                {NEGATIVE_CURRENT_AMOUNT_NOTICE}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-6">
              <FireProgressGauge achievementRate={achievementRate} />
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">目標資産額</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatJpy(fireProgress.targetAmount)}
                  </dd>
                </div>
                {/*
                  ラベルは対象分類によって出し分けない。同じ位置にある数字の呼び名が設定で
                  変わるとB8の参考表示との突き合わせがしづらくなるため、何を数えた額かは
                  併記する分類名だけで示す(同要件B1「負債を含む分類軸の集計」)
                */}
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">現在資産額</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatJpy(fireProgress.currentAmount)}
                  </dd>
                  <dd className="self-center text-xs text-muted-foreground">
                    ({fireProgress.achievementAxisName})
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">到達予測日</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatFireProjection(fireProgress.projection)}
                  </dd>
                </div>
              </dl>
            </div>

            {/*
              「到達見込みなし」のときは**B9・B8の両方**への導線を添える(同要件B1「到達予測日」)。
              前提を置き直せば予測が出ることが分かるようにするためで、片方に絞らないのは、
              この状態になる原因が想定利回り(B9)側とは限らず、積立額(B8)がマイナスで
              資産が減り続ける場合もあるため。B8への導線はカード見出しにもあるが、あちらは
              「目標を設定する」で積立額を直す先には読めないので、ここでは別に出す
            */}
            {fireProgress.projection?.status === "unreachable" ? (
              <p role="status" className="text-xs text-muted-foreground">
                {UNREACHABLE_PROJECTION_NOTICE}{" "}
                <Link
                  href={ASSUMPTION_SETTINGS_LINK.href}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {ASSUMPTION_SETTINGS_LINK.label}
                </Link>
                {" / "}
                <Link
                  href={FIRE_GOAL_LINK.href}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {MONTHLY_CONTRIBUTION_LINK_LABEL}
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
