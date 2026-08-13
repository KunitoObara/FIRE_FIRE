import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildCategoryAxisDebtCountLabel,
  buildCategoryAxisMissingDebtLabel,
  buildCategoryAxisMissingPropertyLabel,
  buildCategoryAxisPropertyCountLabel,
  CATEGORY_AXIS_ALL_TYPES_LABEL,
  CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT,
  NO_CATEGORY_AXES_LABEL,
} from "@/constants/asset-categories";
import { CATEGORY_COLOR_SLOT_COUNT } from "@/constants/dashboard";
import { resolveCategoryAxisDebtReferences } from "@/lib/asset-categories/debt-references";
import { resolveCategoryAxisPropertyReferences } from "@/lib/asset-categories/property-references";

import type { JSX } from "react";

/**
 * 分類軸の色スロット。登録順のインデックスをそのまま`--chart-N`に対応させる
 * (DESIGN.md 3章、`src/lib/dashboard/category-color.ts`と同じ考え方)。
 * スロット数を超える分類は、一覧上は識別用の色を諦めグレーのドットにする
 * (円グラフと違って隣接スライスの識別性は問題にならないが、色を機械的に作って回さない方針は揃える)。
 */
const resolveDotColor = (index: number): string =>
  index < CATEGORY_COLOR_SLOT_COUNT ? `var(--chart-${index + 1})` : "var(--muted-foreground)";

/** 資産種別の一覧表示。件数が多い場合は先頭だけ出して残りを「ほかN件」にまとめる */
const buildAssetTypeSummary = (assetTypeNames: string[]): string => {
  if (assetTypeNames.length === 0) {
    return CATEGORY_AXIS_ALL_TYPES_LABEL;
  }

  const shown = assetTypeNames.slice(0, CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT);
  const remaining = assetTypeNames.length - shown.length;

  return remaining > 0 ? `${shown.join("、")} ほか${remaining}件` : shown.join("、");
};

/**
 * 紐付け状況の1行(B4の表示項目)。
 *
 * **負債を含む軸にだけ**資産種別に続けて負債の件数を出す(例:「すべての資産種別が対象 / 負債 2件」)。
 * 負債を含む軸かどうかが一覧で分からないと、B1で値が資産合計と違う理由が追えない。
 * 含まない軸に「負債なし」と書き添えないのは、大半の軸に同じ但し書きが並ぶだけになるため
 * (docs/screen-requirements-dashboard.md B4)。
 *
 * 負債の名前は出さず件数だけにする。名前まで並べると資産種別と混ざって、どちらが
 * 足される側でどちらが引かれる側なのかが読み取れなくなる。
 */
const buildMemberSummary = (
  axis: AssetCategoryAxisDocument,
  references: CategoryAxisDebtReferences | null,
  propertyReferences: CategoryAxisPropertyReferences | null,
): string => {
  const parts = [buildAssetTypeSummary(axis.assetTypeNames)];
  const propertyIds = Object.keys(axis.propertyValuations);

  /*
    並びは集計の式と同じ「資産種別 → 不動産 → 負債」にする(B4)。読む順が
    足すもの・引くものの順になる
  */
  if (propertyIds.length > 0) {
    /*
      件数は**実際に集計へ加わる物件**の数で出す(負債と同じ理由)。利ざや / 時価の内訳は
      出さない — 反映方法は物件ごとに変わるので、内訳まで並べると1行に収まらない
    */
    const propertyCount =
      propertyReferences === null
        ? propertyIds.length
        : Object.keys(propertyReferences.activeValuations).length;

    parts.push(buildCategoryAxisPropertyCountLabel(propertyCount));
  }

  if (axis.debtIds.length > 0) {
    /*
      件数は**実際に差し引かれる負債**の数で出す(B4)。参照の数をそのまま出すと、一覧の
      「負債 2件」とB1で差し引かれている額が食い違い、一覧に件数を出した目的そのものを外す。
      負債の選択肢がまだ読めていない間は絞り込めないので、参照の数をそのまま出す
    */
    parts.push(
      buildCategoryAxisDebtCountLabel(
        references === null ? axis.debtIds.length : references.activeIds.length,
      ),
    );
  }

  return parts.join(" / ");
};

/**
 * 登録済み分類一覧(B4の表示項目)。
 *
 * 件数が固定である前提のレイアウトは組まない(DESIGN.md 1章「マスタデータ由来の項目を
 * コードにハードコードしない」)。
 */
export const AssetCategoryAxisList = ({
  axes,
  debtOptions,
  propertyOptions,
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
        {axes.map((axis, index) => {
          const references = resolveCategoryAxisDebtReferences(axis.debtIds, debtOptions);
          const propertyReferences = resolveCategoryAxisPropertyReferences(
            axis.propertyValuations,
            propertyOptions,
          );

          return (
            <li key={axis.id} className="flex items-center gap-3 px-5 py-4">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: resolveDotColor(index) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{axis.name}</p>
                <p className="text-xs text-muted-foreground">
                  {buildMemberSummary(axis, references, propertyReferences)}
                  {/*
                    B11で削除された負債を参照している軸にだけ注記を添える(B4)。行の一部
                    として最初から出ている文字なので`role="status"`は付けない — 軸の数だけ
                    ライブリージョンが並び、再描画のたびに読み上げが走ることになるため。
                    動的に現れる編集フォーム側の案内にだけ付ける
                  */}
                  {propertyReferences !== null && propertyReferences.missingCount > 0 ? (
                    <span className="ml-1 text-destructive">
                      {buildCategoryAxisMissingPropertyLabel(propertyReferences.missingCount)}
                    </span>
                  ) : null}
                  {references !== null && references.missingCount > 0 ? (
                    <span className="ml-1 text-destructive">
                      {buildCategoryAxisMissingDebtLabel(references.missingCount)}
                    </span>
                  ) : null}
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
          );
        })}
      </ul>
    </Card>
  );
};
