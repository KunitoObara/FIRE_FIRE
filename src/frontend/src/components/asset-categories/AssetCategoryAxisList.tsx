import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CATEGORY_AXIS_ALL_TYPES_LABEL,
  CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT,
  NO_CATEGORY_AXES_LABEL,
} from "@/constants/asset-categories";
import { CATEGORY_COLOR_SLOT_COUNT } from "@/constants/dashboard";

import type { JSX } from "react";

/**
 * 分類軸の色スロット。登録順のインデックスをそのまま`--chart-N`に対応させる
 * (DESIGN.md 3章、`src/lib/dashboard/category-color.ts`と同じ考え方)。
 * スロット数を超える分類は、一覧上は識別用の色を諦めグレーのドットにする
 * (円グラフと違って隣接スライスの識別性は問題にならないが、色を機械的に作って回さない方針は揃える)。
 */
const resolveDotColor = (index: number): string =>
  index < CATEGORY_COLOR_SLOT_COUNT ? `var(--chart-${index + 1})` : "var(--muted-foreground)";

/** 集計対象の一覧表示。件数が多い場合は先頭だけ出して残りを「ほかN件」にまとめる */
const buildMemberSummary = (assetTypeNames: string[]): string => {
  if (assetTypeNames.length === 0) {
    return CATEGORY_AXIS_ALL_TYPES_LABEL;
  }

  const shown = assetTypeNames.slice(0, CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT);
  const remaining = assetTypeNames.length - shown.length;

  return remaining > 0 ? `${shown.join("、")} ほか${remaining}件` : shown.join("、");
};

/**
 * 登録済み分類一覧(B4の表示項目)。
 *
 * 件数が固定である前提のレイアウトは組まない(DESIGN.md 1章「マスタデータ由来の項目を
 * コードにハードコードしない」)。
 */
export const AssetCategoryAxisList = ({
  axes,
  onEdit,
  onDelete,
}: AssetCategoryAxisListProps): JSX.Element => {
  if (axes.length === 0) {
    return (
      <Card>
        <p className="px-5 py-6 text-sm text-muted-foreground">{NO_CATEGORY_AXES_LABEL}</p>
      </Card>
    );
  }

  return (
    <Card className="py-0">
      <ul className="divide-y divide-border">
        {axes.map((axis, index) => (
          <li key={axis.id} className="flex items-center gap-3 px-5 py-4">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: resolveDotColor(index) }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{axis.name}</p>
              <p className="text-xs text-muted-foreground">
                {buildMemberSummary(axis.assetTypeNames)}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(axis)}>
              編集
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(axis)}
            >
              削除
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
