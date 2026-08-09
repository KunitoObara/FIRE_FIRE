"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FireGoalForm } from "@/components/fire-goal/FireGoalForm";
import { FireGoalSummary } from "@/components/fire-goal/FireGoalSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_AXES_QUERY_KEY } from "@/constants/asset-categories";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import { DEBTS_QUERY_KEY } from "@/constants/debts";
import {
  ACHIEVEMENT_AXIS_MISSING_MESSAGE,
  FIRE_GOAL_DESCRIPTION,
  FIRE_GOAL_FAILURE_MESSAGES,
  FIRE_GOAL_QUERY_KEY,
  FIRE_GOAL_SAVED_MESSAGE,
  LATEST_ASSET_SNAPSHOT_QUERY_KEY,
} from "@/constants/fire-goal";
import { DASHBOARD_PATH } from "@/constants/routes";
import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import { fetchLatestAssetSnapshot } from "@/lib/csv-import/asset-balance-repository";
import { resolveAchievementAmount, resolveAchievementAxis } from "@/lib/dashboard/fire-progress";
import { fetchDebts } from "@/lib/debts/debt-repository";
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

  // 対象分類の選択肢(B4の分類軸)。参考表示ではなく入力項目の選択肢なので、
  // 目標本体と同じく揃うまで待つ。どちらもFirestoreを同じ権限で引くため、片方だけ失敗する
  // ことは実質的に起きない(失敗理由はログイン切れ・権限・設定不備のいずれかに集約される)
  const axesQuery = useQuery({ queryKey: CATEGORY_AXES_QUERY_KEY, queryFn: fetchCategoryAxes });

  const snapshotQuery = useQuery({
    queryKey: LATEST_ASSET_SNAPSHOT_QUERY_KEY,
    queryFn: fetchLatestAssetSnapshot,
  });

  /*
    負債(B11)も参考表示に要る。対象分類に負債を含む分類軸を選ぶと現在資産額は負債控除後の
    額になり(docs/screen-requirements-fire-goal.md B8)、B1のゲージと同じ値を出すには
    同じ入力が要るため。現在資産額と同じく参考表示なので、取得できなくても目標は設定できる
  */
  const debtsQuery = useQuery({ queryKey: DEBTS_QUERY_KEY, queryFn: fetchDebts });

  /**
   * 選択中の対象分類。`undefined`は「まだ触っていない」で、保存済みの設定に追従する。
   *
   * 保存済みの値をstateの初期値に写し取らないのは、取得が終わる前にこのstateが決まって
   * しまうため。触るまでは保存済みの値を唯一の出所にしておき、選択で初めて上書きする。
   */
  const [selectedAxisId, setSelectedAxisId] = useState<string | null | undefined>(undefined);

  const goalResult = goalQuery.data;
  const axesResult = axesQuery.data;
  const axes = axesResult?.ok === true ? axesResult.axes : [];
  const savedAxisId = goalResult?.ok === true ? (goalResult.goal?.achievementAxisId ?? null) : null;

  /*
    保存済みの対象分類がB4で削除されていた場合は、画面を開いた時点で既定に戻して
    その旨を出す(要件B8)。存在しない選択肢を選択中として出すことはできず、黙って戻すと
    設定し直したことに気付けないため。B4側の削除は禁止しない。
  */
  const savedAxisMissing = savedAxisId !== null && !axes.some((axis) => axis.id === savedAxisId);
  /** 触るまでの選択状態。削除済みの分類軸を指していた場合はここで既定へ戻す */
  const initialAxisId = savedAxisMissing ? null : savedAxisId;
  const achievementAxisId = selectedAxisId === undefined ? initialAxisId : selectedAxisId;

  // 参考表示の現在資産額は選択中(未保存)の対象分類で集計する。B1のゲージと同じ解決・
  // 同じ集計を通すので、保存後に画面をまたいでも同じ値・同じ分類名になる
  const achievementAxis = resolveAchievementAxis(achievementAxisId, axes);
  // 現在資産額は参考表示なので、取得できなくても目標の設定は続けられるようにする。
  // 失敗を重ねて表示しても増える情報が無く、「—」で分からないことは伝わる
  const latestSnapshot = snapshotQuery.data?.ok === true ? snapshotQuery.data.snapshot : null;
  const debts = debtsQuery.data?.ok === true ? debtsQuery.data.debts : [];
  const currentAssetTotal = resolveAchievementAmount(
    achievementAxis,
    latestSnapshot ?? undefined,
    debts,
  );

  const handleSubmit = async (goal: FireGoal): Promise<SaveFireGoalResult> => {
    const saved = await saveFireGoal(goal);

    if (saved.ok) {
      toast.success(FIRE_GOAL_SAVED_MESSAGE);
      // B8に戻ってきたときに前回の値から再開できるよう、保存した目標を取り直させる
      void queryClient.invalidateQueries({ queryKey: FIRE_GOAL_QUERY_KEY });
      // 遷移先のB1はこの目標でFIRE達成度を出す。古い目標のゲージを一瞬見せない
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });
      router.push(DASHBOARD_PATH);
    }

    return saved;
  };

  if (goalQuery.isPending || goalResult === undefined || axesQuery.isPending) {
    return <Skeleton className="h-96 w-full max-w-2xl" />;
  }

  if (!goalResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {FIRE_GOAL_FAILURE_MESSAGES[goalResult.reason]}
      </p>
    );
  }

  if (axesResult !== undefined && !axesResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {FIRE_GOAL_FAILURE_MESSAGES[axesResult.reason]}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">{FIRE_GOAL_DESCRIPTION}</p>

      {/*
        対象分類が削除されていて既定に戻した場合の案内。選択で上書きしたあとは出さない
        (自分で選び直したものが選択中になっており、戻された話ではなくなるため)
      */}
      {savedAxisMissing && selectedAxisId === undefined ? (
        <p role="status" className="max-w-2xl text-sm text-destructive">
          {ACHIEVEMENT_AXIS_MISSING_MESSAGE}
        </p>
      ) : null}

      <FireGoalSummary
        savedMode={goalResult.goal?.mode ?? null}
        currentAssetTotal={currentAssetTotal}
        achievementAxisName={achievementAxis.name}
      />

      <FireGoalForm
        initialValues={toFireGoalFormValues(goalResult.goal)}
        currentAssetTotal={currentAssetTotal}
        achievementAxisName={achievementAxis.name}
        achievementAxisOptions={axes}
        achievementAxisId={achievementAxisId}
        onAchievementAxisChange={setSelectedAxisId}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
