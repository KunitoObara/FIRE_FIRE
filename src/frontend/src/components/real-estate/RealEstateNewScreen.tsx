"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RealEstateForm } from "@/components/real-estate/RealEstateForm";
import {
  REAL_ESTATE_FORM_INITIAL_VALUES,
  REAL_ESTATE_PROPERTIES_QUERY_KEY,
  REAL_ESTATE_SAVED_MESSAGES,
} from "@/constants/real-estate";
import { buildRealEstateDetailPath, REAL_ESTATE_PATH } from "@/constants/routes";
import { createRealEstateProperty } from "@/lib/real-estate/property-repository";

import type { JSX } from "react";

/**
 * B7 不動産登録・編集画面(新規登録モード)。
 *
 * 保存に成功したら登録した物件のB6へ遷移し、キャンセルは遷移元のB5に戻る
 * (docs/screen-requirements-real-estate.md B7の遷移条件)。
 *
 * 一覧のキャッシュは取り直させる。登録直後にB5へ戻ったとき、登録した物件が並んでいないと
 * 保存できたのかどうか判断できないため。
 */
export const RealEstateNewScreen = (): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSubmit = async (
    input: RealEstatePropertyInput,
  ): Promise<SaveRealEstatePropertyResult> => {
    const result = await createRealEstateProperty(input);

    if (result.ok) {
      toast.success(REAL_ESTATE_SAVED_MESSAGES.create);
      void queryClient.invalidateQueries({ queryKey: REAL_ESTATE_PROPERTIES_QUERY_KEY });
      router.push(buildRealEstateDetailPath(result.id));
    }

    return result;
  };

  return (
    <RealEstateForm
      mode="create"
      initialValues={REAL_ESTATE_FORM_INITIAL_VALUES}
      cancelHref={REAL_ESTATE_PATH}
      onSubmit={handleSubmit}
    />
  );
};
