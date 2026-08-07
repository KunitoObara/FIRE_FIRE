"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RealEstateForm } from "@/components/real-estate/RealEstateForm";
import { RealEstateNotFoundCard } from "@/components/real-estate/RealEstateNotFoundCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildRealEstatePropertyQueryKey,
  REAL_ESTATE_FAILURE_MESSAGES,
  REAL_ESTATE_PROPERTIES_QUERY_KEY,
  REAL_ESTATE_SAVED_MESSAGES,
} from "@/constants/real-estate";
import { buildRealEstateDetailPath } from "@/constants/routes";
import { toRealEstateFormValues } from "@/lib/real-estate/form-values";
import {
  fetchRealEstateProperty,
  updateRealEstateProperty,
} from "@/lib/real-estate/property-repository";

import type { JSX } from "react";

/**
 * B7 不動産登録・編集画面(編集モード)。
 *
 * 既存の登録値をプリセットするため、フォームを出す前に対象の物件を取得する
 * (docs/screen-requirements-real-estate.md B7の表示項目)。取得できるまでフォームを
 * 描かないのは、空のフォームが一瞬見えてから値が入ると、書き換えたのか読み込み中なのかが
 * 分からないため。
 *
 * 保存に成功したらその物件のB6へ、キャンセルも遷移元のB6へ戻る(B7の遷移条件)。
 */
export const RealEstateEditScreen = ({
  propertyId,
}: RealEstatePropertyScreenProps): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const propertyQuery = useQuery({
    queryKey: buildRealEstatePropertyQueryKey(propertyId),
    queryFn: () => fetchRealEstateProperty(propertyId),
  });

  const result = propertyQuery.data;

  const handleSubmit = async (
    input: RealEstatePropertyInput,
  ): Promise<SaveRealEstatePropertyResult> => {
    const saved = await updateRealEstateProperty(propertyId, input);

    if (saved.ok) {
      toast.success(REAL_ESTATE_SAVED_MESSAGES.edit);
      // 一覧(B5)と、遷移先である当の物件(B6)の両方が古い値のままにならないようにする
      void queryClient.invalidateQueries({ queryKey: REAL_ESTATE_PROPERTIES_QUERY_KEY });
      void queryClient.invalidateQueries({
        queryKey: buildRealEstatePropertyQueryKey(propertyId),
      });
      router.push(buildRealEstateDetailPath(propertyId));
    }

    return saved;
  };

  if (propertyQuery.isPending || result === undefined) {
    return <Skeleton className="h-96 w-full max-w-2xl" />;
  }

  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {REAL_ESTATE_FAILURE_MESSAGES[result.reason]}
      </p>
    );
  }

  if (result.property === null) {
    return <RealEstateNotFoundCard />;
  }

  return (
    <RealEstateForm
      mode="edit"
      initialValues={toRealEstateFormValues(result.property)}
      cancelHref={buildRealEstateDetailPath(propertyId)}
      onSubmit={handleSubmit}
    />
  );
};
