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
} from "@/constants/asset-categories";
import {
  createCategoryAxis,
  deleteCategoryAxis,
  fetchAssetTypeOptions,
  fetchCategoryAxes,
  updateCategoryAxis,
} from "@/lib/asset-categories/category-axis-repository";

import type { JSX } from "react";

const EMPTY_FORM_VALUES: AssetCategoryAxisFormValues = { name: "", assetTypeNames: [] };

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

  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingAxis, setEditingAxis] = useState<AssetCategoryAxisDocument | null>(null);
  const [deletingAxis, setDeletingAxis] = useState<AssetCategoryAxisDocument | null>(null);

  const axes = axesQuery.data?.ok === true ? axesQuery.data.axes : [];
  const assetTypeOptions =
    assetTypeOptionsQuery.data?.ok === true ? assetTypeOptionsQuery.data.assetTypeNames : [];

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
              initialValues={{ name: editingAxis.name, assetTypeNames: editingAxis.assetTypeNames }}
              assetTypeOptions={assetTypeOptions}
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
      ) : (
        <AssetCategoryAxisList axes={axes} onEdit={handleEdit} onDelete={setDeletingAxis} />
      )}

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
