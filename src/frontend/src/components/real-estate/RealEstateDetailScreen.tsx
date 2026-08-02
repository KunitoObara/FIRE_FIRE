"use client";

import { useQuery } from "@tanstack/react-query";

import { RealEstateDetail } from "@/components/real-estate/RealEstateDetail";
import { RealEstateNotFoundCard } from "@/components/real-estate/RealEstateNotFoundCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildRealEstatePropertyQueryKey,
  REAL_ESTATE_FAILURE_MESSAGES,
} from "@/constants/real-estate";
import { fetchRealEstateProperty } from "@/lib/real-estate/property-repository";

import type { JSX } from "react";

/**
 * B6 不動産詳細画面の取得部分(docs/screen-requirements-real-estate.md B6)。
 *
 * 物件の取得はブラウザ側でしかできないため、ページ(Server Component)からIDだけを受け取り、
 * ここでFirestoreを引く。表示そのものは`RealEstateDetail`が持つ。
 *
 * 該当する物件が無い場合は「物件が見つかりません」を出し、遷移はしない(要件の遷移条件)。
 * 取得の失敗とは区別する — 失敗を「見つかりません」と表示すると、通信が復旧すれば見える
 * はずの物件を消えたものと誤解させるため。
 */
export const RealEstateDetailScreen = ({
  propertyId,
}: RealEstatePropertyScreenProps): JSX.Element => {
  const propertyQuery = useQuery({
    queryKey: buildRealEstatePropertyQueryKey(propertyId),
    queryFn: () => fetchRealEstateProperty(propertyId),
  });

  const result = propertyQuery.data;

  if (propertyQuery.isPending || result === undefined) {
    return <Skeleton className="h-64 w-full max-w-3xl" />;
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

  return <RealEstateDetail property={result.property} />;
};
