"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AssetCategoryAxisForm } from "@/components/asset-categories/AssetCategoryAxisForm";
import { AssetCategoryAxisList } from "@/components/asset-categories/AssetCategoryAxisList";
import { DeleteCategoryAxisDialog } from "@/components/asset-categories/DeleteCategoryAxisDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ASSET_TYPE_OPTIONS_QUERY_KEY,
  CATEGORY_AXES_QUERY_KEY,
  CATEGORY_AXIS_LOAD_FAILURE_MESSAGES,
} from "@/constants/asset-categories";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import { DEBT_LOAD_FAILURE_MESSAGES, DEBTS_QUERY_KEY } from "@/constants/debts";
import {
  createCategoryAxis,
  deleteCategoryAxis,
  fetchAssetTypeOptions,
  fetchCategoryAxes,
  updateCategoryAxis,
} from "@/lib/asset-categories/category-axis-repository";
import { fetchDebts } from "@/lib/debts/debt-repository";

import type { JSX } from "react";

const EMPTY_FORM_VALUES: AssetCategoryAxisFormValues = {
  name: "",
  assetTypeNames: [],
  debtIds: [],
};

/**
 * 負債の選択肢の状態を1つの値にまとめる(`resolveAssetTypeOptionsState`と同じ理由)。
 *
 * 空配列に倒すと「読み込み中」「取得失敗」「B11で1件も登録していない」が同じ見た目になる。
 * 負債では実害がさらに大きく、選択肢が出ないまま保存できると、選択済みの負債が黙って
 * 外れた分類軸で上書きされる。
 */
const resolveDebtOptionsState = (result: DebtsResult | undefined): DebtOptionsState => {
  if (result === undefined) {
    return { status: "loading" };
  }

  if (!result.ok) {
    return { status: "error", message: DEBT_LOAD_FAILURE_MESSAGES[result.reason] };
  }

  return { status: "ready", debts: result.debts };
};

/**
 * 編集フォームに渡す初期値を組み立てる。
 *
 * **B11で削除された負債への参照は落とす。** 存在しない負債を選択中として出すことはできず、
 * 集計対象にもしないため(docs/screen-requirements-dashboard.md B4)。保存し直せば
 * ドキュメント側の参照も消える。負債の選択肢がまだ読めていない間は絞り込めないので、
 * その状態では保存自体をフォーム側が止める。
 */
const toEditingFormValues = (
  axis: AssetCategoryAxisDocument,
  debtOptions: DebtOptionsState,
): AssetCategoryAxisFormValues => {
  if (debtOptions.status !== "ready") {
    return { name: axis.name, assetTypeNames: axis.assetTypeNames, debtIds: axis.debtIds };
  }

  const existingIds = new Set(debtOptions.debts.map((debt) => debt.id));

  return {
    name: axis.name,
    assetTypeNames: axis.assetTypeNames,
    debtIds: axis.debtIds.filter((debtId) => existingIds.has(debtId)),
  };
};

/**
 * 集計対象の選択肢の状態を1つの値にまとめる。
 *
 * 空配列に倒すと「読み込み中」「取得失敗」「CSV未取込」が同じ見た目になり、
 * 案内の文言と保存の可否がずれる(B4-1・B4-2)。3つを型で分けて持たせる。
 */
const resolveAssetTypeOptionsState = (
  result: AssetTypeOptionsResult | undefined,
): AssetTypeOptionsState => {
  /*
    結果がまだ無いあいだが読み込み中。`isPending`は見ない — `fetchAssetTypeOptions`は
    失敗も`ok: false`として解決するので結果が`undefined`のままなのは取得中だけで、
    両方を見ると同じ状態を2つの条件で書くことになる(レビュー指摘)
  */
  if (result === undefined) {
    return { status: "loading" };
  }

  if (!result.ok) {
    return { status: "error", message: CATEGORY_AXIS_LOAD_FAILURE_MESSAGES[result.reason] };
  }

  return { status: "ready", assetTypeNames: result.assetTypeNames };
};

/**
 * B4 資産分類マスタ設定画面の本体(docs/screen-requirements-dashboard.md B4)。
 *
 * 一覧・新規追加フォーム・編集フォーム・削除ダイアログをまとめる。Firestoreへの読み書きは
 * ブラウザ側で行うため画面全体をClient Componentにしている(認証をブラウザのFirebase SDKが
 * 持っており、サーバー側から`uid`を特定できないため。B2 CSV取込と同じ理由)。
 *
 * 保存・削除の成否にかかわらず、確定後は一覧・集計対象の選択肢をどちらも取り直す。
 * 集計対象の選択肢自体はここでは変わらないが、無条件に併せて取り直しても実害が無く、
 * 「取込直後に選択肢が古いまま」のような取り違えを避けられる。
 */
export const AssetCategoryMasterScreen = (): JSX.Element => {
  const queryClient = useQueryClient();

  const axesQuery = useQuery({ queryKey: CATEGORY_AXES_QUERY_KEY, queryFn: fetchCategoryAxes });
  const assetTypeOptionsQuery = useQuery({
    queryKey: ASSET_TYPE_OPTIONS_QUERY_KEY,
    queryFn: fetchAssetTypeOptions,
  });
  // 集計対象に含める負債の選択肢(B4「集計対象に負債を含める」)。B11の登録済みの負債そのもの
  const debtsQuery = useQuery({ queryKey: DEBTS_QUERY_KEY, queryFn: fetchDebts });

  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingAxis, setEditingAxis] = useState<AssetCategoryAxisDocument | null>(null);
  const [deletingAxis, setDeletingAxis] = useState<AssetCategoryAxisDocument | null>(null);

  /*
    取得の失敗を空配列に倒さない。倒すと「分類軸が0件」「CSV未取込」の案内に化けて、
    取り込み済みでも未取込に見える(B4-1)。失敗は失敗として出す(B1・B5と同じ扱い)
  */
  const axesResult = axesQuery.data;
  const axes = axesResult?.ok === true ? axesResult.axes : [];
  const axesFailureReason = axesResult !== undefined && !axesResult.ok ? axesResult.reason : null;

  const assetTypeOptions = resolveAssetTypeOptionsState(assetTypeOptionsQuery.data);
  const debtOptions = resolveDebtOptionsState(debtsQuery.data);

  const closeForm = (): void => {
    setFormMode("closed");
    setEditingAxis(null);
  };

  const handleCreate = (): void => {
    setEditingAxis(null);
    setFormMode("create");
  };

  const handleEdit = (axis: AssetCategoryAxisDocument): void => {
    setEditingAxis(axis);
    setFormMode("edit");
  };

  const handleSubmit = async (
    values: AssetCategoryAxisFormValues,
  ): Promise<SaveCategoryAxisResult> => {
    const result =
      formMode === "edit" && editingAxis !== null
        ? await updateCategoryAxis(editingAxis.id, values)
        : await createCategoryAxis(values);

    if (result.ok) {
      toast.success(formMode === "edit" ? "分類を更新しました" : "分類を追加しました");
      closeForm();
      void queryClient.invalidateQueries({ queryKey: CATEGORY_AXES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSET_TYPE_OPTIONS_QUERY_KEY });
      // 分類軸はB1の軸セレクタと集計そのものを決めるので、B1の表示データも取り直させる
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });
    }

    return result;
  };

  const handleDeleteConfirm = async (
    axis: AssetCategoryAxisDocument,
  ): Promise<DeleteCategoryAxisResult> => {
    const result = await deleteCategoryAxis(axis.id);

    if (result.ok) {
      toast.success("分類を削除しました");
      void queryClient.invalidateQueries({ queryKey: CATEGORY_AXES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ASSET_TYPE_OPTIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });
    }

    return result;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          分類軸はユーザーが自由に追加・編集できます。ここでの変更はダッシュボードの分類軸セレクタにも反映されます。
        </p>
        {formMode === "closed" ? (
          <Button type="button" size="sm" className="shrink-0" onClick={handleCreate}>
            新規分類を追加
          </Button>
        ) : null}
      </div>

      {formMode === "create" ? (
        <Card>
          <CardContent>
            <h2 className="mb-4 text-sm font-semibold">新規分類</h2>
            <AssetCategoryAxisForm
              initialValues={EMPTY_FORM_VALUES}
              assetTypeOptions={assetTypeOptions}
              debtOptions={debtOptions}
              submitLabel="保存"
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </CardContent>
        </Card>
      ) : null}

      {formMode === "edit" && editingAxis !== null ? (
        <Card>
          <CardContent>
            <h2 className="mb-4 text-sm font-semibold">分類を編集</h2>
            <AssetCategoryAxisForm
              key={editingAxis.id}
              initialValues={toEditingFormValues(editingAxis, debtOptions)}
              assetTypeOptions={assetTypeOptions}
              debtOptions={debtOptions}
              submitLabel="保存"
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          </CardContent>
        </Card>
      ) : null}

      {axesQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {axesFailureReason ? (
        <p role="alert" className="text-sm text-destructive">
          {CATEGORY_AXIS_LOAD_FAILURE_MESSAGES[axesFailureReason]}
        </p>
      ) : null}

      {!axesQuery.isPending && axesFailureReason === null ? (
        <AssetCategoryAxisList axes={axes} onEdit={handleEdit} onDelete={setDeletingAxis} />
      ) : null}

      <DeleteCategoryAxisDialog
        axis={deletingAxis}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingAxis(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
