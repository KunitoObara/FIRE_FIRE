"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FireGoalForm } from "@/components/fire-goal/FireGoalForm";
import { FireGoalSummary } from "@/components/fire-goal/FireGoalSummary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CURRENT_ASSET_TOTAL_QUERY_KEY,
  FIRE_GOAL_DESCRIPTION,
  FIRE_GOAL_FAILURE_MESSAGES,
  FIRE_GOAL_QUERY_KEY,
  FIRE_GOAL_SAVED_MESSAGE,
} from "@/constants/fire-goal";
import { DASHBOARD_PATH } from "@/constants/routes";
import { fetchLatestAssetTotal } from "@/lib/csv-import/asset-balance-repository";
import { fetchFireGoal, saveFireGoal } from "@/lib/fire-goal/fire-goal-repository";
import { toFireGoalFormValues } from "@/lib/fire-goal/form-values";

import type { JSX } from "react";

/**
 * B8 FIRE目標設定画面の本体(docs/screen-requirements-fire-goal.md B8)。
 *
 * 保存済みの目標を初期値に入れるため、フォームを出す前に取得を待つ。空のフォームが一瞬
 * 見えてから値が入ると、書き換えたのか読み込み中なのかが分からないため(B7 編集モードと同じ)。
 *
 * 保存に成功したらB1へ遷移する(要件の遷移条件)。Firestoreの読み書きはブラウザ側の
 * Firebase SDK頼み(サーバー側から`uid`を特定できない)なのでClient Componentにしている。
 */
export const FireGoalScreen = (): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const goalQuery = useQuery({
    queryKey: FIRE_GOAL_QUERY_KEY,
    queryFn: fetchFireGoal,
  });

  const currentAssetQuery = useQuery({
    queryKey: CURRENT_ASSET_TOTAL_QUERY_KEY,
    queryFn: fetchLatestAssetTotal,
  });

  const goalResult = goalQuery.data;

  // 現在資産額は参考表示なので、取得できなくても目標の設定は続けられるようにする。
  // 失敗を重ねて表示しても増える情報が無く、「—」で分からないことは伝わる
  const currentAssetTotal =
    currentAssetQuery.data?.ok === true ? currentAssetQuery.data.total : null;

  const handleSubmit = async (goal: FireGoal): Promise<SaveFireGoalResult> => {
    const saved = await saveFireGoal(goal);

    if (saved.ok) {
      toast.success(FIRE_GOAL_SAVED_MESSAGE);
      // B8に戻ってきたときに前回の値から再開できるよう、保存した目標を取り直させる
      void queryClient.invalidateQueries({ queryKey: FIRE_GOAL_QUERY_KEY });
      router.push(DASHBOARD_PATH);
    }

    return saved;
  };

  if (goalQuery.isPending || goalResult === undefined) {
    return <Skeleton className="h-96 w-full max-w-2xl" />;
  }

  if (!goalResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {FIRE_GOAL_FAILURE_MESSAGES[goalResult.reason]}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{FIRE_GOAL_DESCRIPTION}</p>

      <FireGoalSummary
        savedMode={goalResult.goal?.mode ?? null}
        currentAssetTotal={currentAssetTotal}
      />

      <FireGoalForm
        initialValues={toFireGoalFormValues(goalResult.goal)}
        currentAssetTotal={currentAssetTotal}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
