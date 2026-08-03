"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AssumptionSettingsForm } from "@/components/assumptions/AssumptionSettingsForm";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ASSUMPTIONS_DESCRIPTION,
  ASSUMPTIONS_FAILURE_MESSAGES,
  ASSUMPTIONS_QUERY_KEY,
  ASSUMPTIONS_SAVED_MESSAGE,
  LATEST_ASSET_BALANCES_QUERY_KEY,
  NO_ASSET_BALANCES_EMPTY_STATE,
} from "@/constants/assumptions";
import { DASHBOARD_PATH } from "@/constants/routes";
import { fetchAssumptions, saveAssumptions } from "@/lib/assumptions/assumption-repository";
import { toAssetAssumptions, toAssumptionsFormValues } from "@/lib/assumptions/form-values";
import { fetchLatestAssetBalances } from "@/lib/csv-import/asset-balance-repository";

import type { JSX } from "react";

/** 取得に失敗した理由の表示(AssumptionSettingsScreen内専用) */
const AssumptionsFailure = ({ reason }: AssumptionsFailureProps): JSX.Element => (
  <p role="alert" className="text-sm text-destructive">
    {ASSUMPTIONS_FAILURE_MESSAGES[reason]}
  </p>
);

/**
 * B9 想定利回り・リスク設定画面の本体(docs/screen-requirements-fire-goal.md B9)。
 *
 * 一覧の行(資産種別と現在残高)は直近の資産残高から、各行の初期値は保存済みの設定から
 * 作るため、フォームを出す前に両方の取得を待つ。空のフォームが一瞬見えてから値が入ると、
 * 書き換えたのか読み込み中なのかが分からないため(B7・B8と同じ)。
 *
 * 保存に成功したらB1へ遷移する(要件の「B1のFIRE到達予測計算・リスク可視化に反映」)。
 * Firestoreの読み書きはブラウザ側のFirebase SDK頼み(サーバー側から`uid`を特定できない)
 * なのでClient Componentにしている。
 */
export const AssumptionSettingsScreen = (): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const balancesQuery = useQuery({
    queryKey: LATEST_ASSET_BALANCES_QUERY_KEY,
    queryFn: fetchLatestAssetBalances,
  });

  const assumptionsQuery = useQuery({
    queryKey: ASSUMPTIONS_QUERY_KEY,
    queryFn: fetchAssumptions,
  });

  const balancesResult = balancesQuery.data;
  const assumptionsResult = assumptionsQuery.data;

  const handleSubmit = async (values: AssumptionsFormValues): Promise<SaveAssumptionsResult> => {
    // 一覧に出ていない資産種別の設定を消さないよう、保存済みの設定を引き継ぎ元として渡す
    const saved = assumptionsResult?.ok === true ? assumptionsResult.assumptions : {};
    const result = await saveAssumptions(toAssetAssumptions(values, saved));

    if (result.ok) {
      toast.success(ASSUMPTIONS_SAVED_MESSAGE);
      // B9に戻ってきたときに前回の値から再開できるよう、保存した設定を取り直させる
      void queryClient.invalidateQueries({ queryKey: ASSUMPTIONS_QUERY_KEY });
      router.push(DASHBOARD_PATH);
    }

    return result;
  };

  if (
    balancesQuery.isPending ||
    assumptionsQuery.isPending ||
    balancesResult === undefined ||
    assumptionsResult === undefined
  ) {
    return <Skeleton className="h-80 w-full" />;
  }

  // 残高・設定のどちらが失敗しても入力を始められない(行が出せない/初期値が入らない)ため、
  // 理由を出してフォームは出さない
  if (!balancesResult.ok) {
    return <AssumptionsFailure reason={balancesResult.reason} />;
  }

  if (!assumptionsResult.ok) {
    return <AssumptionsFailure reason={assumptionsResult.reason} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-3xl text-sm text-muted-foreground">{ASSUMPTIONS_DESCRIPTION}</p>

      {balancesResult.balances.length === 0 ? (
        <Card>
          <CardContent>
            <DashboardEmptyState {...NO_ASSET_BALANCES_EMPTY_STATE} />
          </CardContent>
        </Card>
      ) : (
        <AssumptionSettingsForm
          balances={balancesResult.balances}
          initialValues={toAssumptionsFormValues(
            balancesResult.balances,
            assumptionsResult.assumptions,
          )}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};
