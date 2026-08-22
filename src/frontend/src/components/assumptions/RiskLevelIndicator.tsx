import { Badge } from "@/components/ui/badge";
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
 * **既定(`colored={true}`)ではモック(b9-assumption-settings.html)に合わせた角丸バッジで表示する**
 * (`--chart-1/4/8`を低不透明度の背景として使い、新規の色トークンは定義しない。
 * `ASSUMPTION_RISK_LEVELS`のコメント参照)。B9の選択肢一覧・選択済み表示のどちらもこの形になる。
 *
 * **バッジの文字色は着色しない。** `--chart-1/4/8`は文字色としてのコントラストが検証されて
 * いない値で、特に`--chart-4`は対白コントラストが約2.17:1しかなくWCAG AAの4.5:1を大きく
 * 下回る。色を当てるのはアイコン(装飾・`aria-hidden`)だけに留め、文字はテーマの既定色
 * (`Badge`の`secondary`バリアント由来)のまま可読性を保つ。
 *
 * **色を落とした形でも使える**(`colored={false}`)。B1の分類別内訳の凡例がそれで、
 * 同じ行に資産分類のスロット色が並ぶため、リスクにも色を当てると読み分けられなくなる
 * (docs/screen-requirements-dashboard.md B1「リスクの可視化」)。この場合はバッジ化せず、
 * 従来どおり色無しの形状アイコン+文字のみにする。形状と文字はB1でも同じものを使う —
 * 同じリスクレベルが画面によって違う形になると、B9で置いた値との対応が読めないため、
 * この共有そのものが要件になっている。
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

  if (!colored) {
    return (
      // `Badge`ではないので、アイコンの大きさはここで指定する必要がある(下の分岐の注記参照)
      <span className="flex items-center gap-1.5">
        <Icon aria-hidden className="size-3 fill-current" />
        {option.label}
      </span>
    );
  }

  return (
    <Badge variant="secondary" className={option.badgeClassName}>
      {/* 大きさは指定しない。`badgeVariants`が`[&>svg]:size-3!`でBadge配下のsvgに強制するため */}
      <Icon aria-hidden className={cn("fill-current", option.iconClassName)} />
      {option.label}
    </Badge>
  );
};
