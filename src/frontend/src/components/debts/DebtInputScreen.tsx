"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DebtInputForm } from "@/components/debts/DebtInputForm";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_AXES_QUERY_KEY } from "@/constants/asset-categories";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import {
  DEBT_LOAD_FAILURE_MESSAGES,
  DEBT_SAVED_DESCRIPTION,
  DEBT_SAVED_MESSAGE,
  DEBTS_QUERY_KEY,
} from "@/constants/debts";
import { fetchCategoryAxes } from "@/lib/asset-categories/category-axis-repository";
import { fetchDebts, saveDebts } from "@/lib/debts/debt-repository";

import type { JSX } from "react";

/**
 * B11 負債入力画面の本体(docs/screen-requirements-dashboard.md B11)。
 *
 * Firestoreへの読み書きはブラウザ側で行うため画面全体をClient Componentにしている
 * (認証をブラウザのFirebase SDKが持っており、サーバー側から`uid`を特定できないため。
 * B2 CSV取込・B4 資産分類マスタと同じ理由)。
 *
 * 分類軸も併せて取得するのは、保存時の削除確認ダイアログに「この負債を集計対象にしている
 * 分類軸」を出すため。B4の画面を開かずにどの軸の集計が変わるかを確かめられるようにする。
 *
 * フォームは負債の取得後にだけ描く。読み込み中に空のフォームを出すと、登録済みの負債が
 * 1件も無い状態と見分けが付かず、そこで保存すれば登録済みの負債をすべて削除してしまう。
 */
export const DebtInputScreen = (): JSX.Element => {
  const queryClient = useQueryClient();

  const debtsQuery = useQuery({ queryKey: DEBTS_QUERY_KEY, queryFn: fetchDebts });
  const axesQuery = useQuery({ queryKey: CATEGORY_AXES_QUERY_KEY, queryFn: fetchCategoryAxes });

  const handleSave = async (
    inputs: DebtInput[],
    baselineIds: string[],
  ): Promise<SaveDebtsResult> => {
    const result = await saveDebts(inputs, baselineIds);

    if (result.ok) {
      // 保存後も画面に留まる(B2の取込完了と同じ扱い)。続けて別の負債を編集できるようにするため
      toast.success(DEBT_SAVED_MESSAGE, { description: DEBT_SAVED_DESCRIPTION });
      void queryClient.invalidateQueries({ queryKey: DEBTS_QUERY_KEY });
      // 負債はB1の負債サマリと、負債を含む分類軸の集計そのものを変えるので取り直させる
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });
      // 削除した負債はB4の集計対象の選択肢からも消える
      void queryClient.invalidateQueries({ queryKey: CATEGORY_AXES_QUERY_KEY });
      /*
        フォームの行と実IDの同期は再取得ではなく`saveDebts`の戻り値で行う
        (`DebtInputForm`)。ここでの再取得は、B1・B4が参照する側を新しくするためのもの
      */
    }

    return result;
  };

  if (debtsQuery.isPending || axesQuery.isPending) {
    return (
      <div className="flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  /*
    取得の失敗を空配列に倒さない。倒すと「負債が0件」の空状態に化けて、登録済みの負債が
    あるのに無いように見える(B4-1と同じ落とし穴)。この画面では実害がさらに大きく、
    空のフォームで保存すると登録済みの負債をすべて消してしまう
  */
  const debtsResult = debtsQuery.data;
  const axesResult = axesQuery.data;

  if (debtsResult === undefined || !debtsResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {DEBT_LOAD_FAILURE_MESSAGES[debtsResult?.reason ?? "unknown"]}
      </p>
    );
  }

  /*
    分類軸の取得だけが失敗した場合も画面を出さない。削除確認ダイアログに出す
    「集計が変わる分類軸」が黙って空になり、影響のある削除を影響が無いものとして
    確認させることになるため(B11の確認ダイアログの目的そのものが崩れる)
  */
  if (axesResult === undefined || !axesResult.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {DEBT_LOAD_FAILURE_MESSAGES[axesResult?.reason ?? "unknown"]}
      </p>
    );
  }

  return <DebtInputForm debts={debtsResult.debts} axes={axesResult.axes} onSave={handleSave} />;
};
