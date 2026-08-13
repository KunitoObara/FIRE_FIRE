"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RealEstateDetail } from "@/components/real-estate/RealEstateDetail";
import { RealEstateNotFoundCard } from "@/components/real-estate/RealEstateNotFoundCard";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_AXES_QUERY_KEY } from "@/constants/asset-categories";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import {
  buildRealEstatePropertyQueryKey,
  REAL_ESTATE_DELETED_MESSAGE,
  REAL_ESTATE_FAILURE_MESSAGES,
  REAL_ESTATE_PROPERTIES_QUERY_KEY,
} from "@/constants/real-estate";
import { REAL_ESTATE_PATH } from "@/constants/routes";
import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import {
  deleteRealEstateProperty,
  fetchRealEstateProperty,
} from "@/lib/real-estate/property-repository";

import type { JSX } from "react";

/**
 * この物件を集計対象にしている分類軸の名前(B6の削除確認ダイアログ)。
 *
 * 該当する軸は**すべて**返す。物件はチェックボックスで複数の分類軸から独立に選べるため、
 * 同じ物件を2つ以上の軸が対象にしていることがある(B11の`collectAffectedAxisNames`と同じ)。
 *
 * **取得できていないときは`unknown`を返す。** 空配列に倒すと、影響する軸が無いのか
 * 確かめられなかっただけなのかがダイアログから区別できない。削除自体はどちらでも止めない
 * (docs/screen-requirements-real-estate.md「物件の削除」)。
 */
const resolveAffectedAxisNames = (
  result: { ok: true; axes: AssetCategoryAxisDocument[] } | { ok: false } | undefined,
  propertyId: string,
): AffectedAxisNamesState => {
  if (result === undefined || !result.ok) {
    return { status: "unknown" };
  }

  return {
    status: "ready",
    axisNames: result.axes
      .filter((axis) => propertyId in axis.propertyValuations)
      .map((axis) => axis.name),
  };
};

/**
 * B6 不動産詳細画面の取得部分(docs/screen-requirements-real-estate.md B6)。
 *
 * 物件の取得はブラウザ側でしかできないため、ページ(Server Component)からIDだけを受け取り、
 * ここでFirestoreを引く。表示そのものは`RealEstateDetail`が持つ。
 *
 * 該当する物件が無い場合は「物件が見つかりません」を出し、遷移はしない(要件の遷移条件)。
 * 取得の失敗とは区別する — 失敗を「見つかりません」と表示すると、通信が復旧すれば見える
 * はずの物件を消えたものと誤解させるため。
 *
 * 分類軸も併せて読む。B6の表示には要らないが、削除の確認ダイアログが「この物件を集計対象に
 * している分類軸」を列挙するために要る(B6-1)。**この取得の失敗で物件の表示や削除は止めない。**
 */
export const RealEstateDetailScreen = ({
  propertyId,
}: RealEstatePropertyScreenProps): JSX.Element => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const propertyQuery = useQuery({
    queryKey: buildRealEstatePropertyQueryKey(propertyId),
    queryFn: () => fetchRealEstateProperty(propertyId),
  });

  const axesQuery = useQuery({ queryKey: CATEGORY_AXES_QUERY_KEY, queryFn: fetchCategoryAxes });

  const result = propertyQuery.data;

  const handleDelete = async (): Promise<DeleteRealEstatePropertyResult> => {
    const deleted = await deleteRealEstateProperty(propertyId);

    if (!deleted.ok) {
      return deleted;
    }

    /*
      消したはずの物件が一覧に残っていると削除できたのか判断できないため、B5の一覧を
      取り直す(B7の保存と同じ)。ダッシュボードも取り直す — 分類軸がこの物件を集計対象に
      していれば、資産推移グラフ・分類別内訳・FIRE達成度ゲージの値が変わる(B4-8)。
      分類軸そのもの(`categoryAxes`)は書き換えていないので落とさない。残った参照は
      B4側が集計対象から外れたものとして扱う
    */
    void queryClient.invalidateQueries({ queryKey: REAL_ESTATE_PROPERTIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });

    toast.success(REAL_ESTATE_DELETED_MESSAGE);
    router.push(REAL_ESTATE_PATH);

    return deleted;
  };

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

  return (
    <RealEstateDetail
      property={result.property}
      affectedAxisNames={resolveAffectedAxisNames(axesQuery.data, propertyId)}
      onDelete={handleDelete}
    />
  );
};
