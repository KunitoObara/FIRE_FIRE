import { ASSUMPTION_RISK_LEVELS, UNSET_RISK_LEVEL_LABEL } from "@/constants/assumptions";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/**
 * リスクレベルを形状アイコン + 文字で表す(DESIGN.md 3章)。
 *
 * セレクトの選択肢と、選択済みの値の表示の両方でこれを使う。選ぶときと選んだ後で
 * 見た目が変わると、同じ段階を指していることが読み取りにくくなるため。
 *
 * アイコンは`aria-hidden`にして文字だけを読み上げさせる。形状は色を補うためのもので、
 * 読み上げでは「低」「中」「高」の文字がそのまま段階を表す。
 *
 * **色を落とした形でも使える**(`colored={false}`)。B1の分類別内訳の凡例がそれで、
 * 同じ行に資産分類のスロット色が並ぶため、リスクにも色を当てると読み分けられなくなる
 * (docs/screen-requirements-dashboard.md B1「リスクの可視化」)。形状と文字はB1でも
 * 同じものを使う — 同じリスクレベルが画面によって違う形になると、B9で置いた値との
 * 対応が読めないため、この共有そのものが要件になっている。
 */
export const RiskLevelIndicator = ({
  level,
  colored = true,
}: RiskLevelIndicatorProps): JSX.Element => {
  const option = ASSUMPTION_RISK_LEVELS.find((item) => item.id === level);

  if (option === undefined) {
    return <span className="text-muted-foreground">{UNSET_RISK_LEVEL_LABEL}</span>;
  }

  const Icon = option.icon;

  return (
    <span className="flex items-center gap-1.5">
      <Icon aria-hidden className={cn("size-3 fill-current", colored && option.className)} />
      {option.label}
    </span>
  );
};
