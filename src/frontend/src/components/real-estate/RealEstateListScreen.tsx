"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { RealEstatePropertyList } from "@/components/real-estate/RealEstatePropertyList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NO_REAL_ESTATE_EMPTY_STATE,
  REAL_ESTATE_FAILURE_MESSAGES,
  REAL_ESTATE_LIST_DESCRIPTION,
  REAL_ESTATE_NEW_LINK,
  REAL_ESTATE_PROPERTIES_QUERY_KEY,
} from "@/constants/real-estate";
import { fetchRealEstateProperties } from "@/lib/real-estate/property-repository";

import type { JSX } from "react";

/**
 * B5 不動産一覧画面の本体(docs/screen-requirements-real-estate.md B5)。
 *
 * 参照専用の画面だが、物件の取得がブラウザ側のFirebase SDK頼み(サーバー側から`uid`を
 * 特定できない)なのでClient Componentにしている。B4 資産分類マスタと同じ理由・同じ構成。
 *
 * 取得に失敗したときは空状態(「登録済みの物件がまだありません」)を出さない。
 * 登録済みの物件があるのに「1件も無い」と読める表示になるのを避けるため、失敗は失敗として出す。
 */
export const RealEstateListScreen = (): JSX.Element => {
  const propertiesQuery = useQuery({
    queryKey: REAL_ESTATE_PROPERTIES_QUERY_KEY,
    queryFn: fetchRealEstateProperties,
  });

  const result = propertiesQuery.data;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{REAL_ESTATE_LIST_DESCRIPTION}</p>
        <Button asChild size="sm" className="shrink-0">
          <Link href={REAL_ESTATE_NEW_LINK.href}>{REAL_ESTATE_NEW_LINK.label}</Link>
        </Button>
      </div>

      {propertiesQuery.isPending || result === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {result?.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {REAL_ESTATE_FAILURE_MESSAGES[result.reason]}
        </p>
      ) : null}

      {result?.ok === true && result.properties.length === 0 ? (
        <Card>
          <CardContent>
            <DashboardEmptyState {...NO_REAL_ESTATE_EMPTY_STATE} />
          </CardContent>
        </Card>
      ) : null}

      {result?.ok === true && result.properties.length > 0 ? (
        <RealEstatePropertyList properties={result.properties} />
      ) : null}
    </div>
  );
};
