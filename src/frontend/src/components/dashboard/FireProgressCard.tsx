"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DASHBOARD_EMPTY_STATES, FIRE_GOAL_LINK } from "@/constants/dashboard";
import {
  calculateAchievementRate,
  formatProjectedAchievementDate,
} from "@/lib/dashboard/fire-progress";
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
          <div className="flex flex-wrap items-center gap-6">
            <FireProgressGauge achievementRate={achievementRate} />
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">目標資産額</dt>
                <dd className="font-semibold tabular-nums">
                  {formatJpy(fireProgress.targetAmount)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">現在資産額</dt>
                <dd className="font-semibold tabular-nums">
                  {formatJpy(fireProgress.currentAmount)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">到達予測日</dt>
                <dd className="font-semibold tabular-nums">
                  {formatProjectedAchievementDate(fireProgress.projectedAchievementDate)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
