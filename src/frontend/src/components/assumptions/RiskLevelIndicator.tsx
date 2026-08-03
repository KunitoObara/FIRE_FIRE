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
 */
export const RiskLevelIndicator = ({ level }: RiskLevelIndicatorProps): JSX.Element => {
  const option = ASSUMPTION_RISK_LEVELS.find((item) => item.id === level);

  if (option === undefined) {
    return <span className="text-muted-foreground">{UNSET_RISK_LEVEL_LABEL}</span>;
  }

  const Icon = option.icon;

  return (
    <span className="flex items-center gap-1.5">
      <Icon aria-hidden className={cn("size-3 fill-current", option.className)} />
      {option.label}
    </span>
  );
};
