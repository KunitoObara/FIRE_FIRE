import { Card, CardContent } from "@/components/ui/card";
import {
  FIRE_GOAL_ACTIVE_MODE_LABEL,
  FIRE_GOAL_CURRENT_ASSET_LABEL,
  FIRE_GOAL_MODES,
  FIRE_GOAL_REFERENCE_SUFFIX,
  FIRE_GOAL_UNKNOWN_ASSET_LABEL,
  FIRE_GOAL_UNSET_MODE_LABEL,
} from "@/constants/fire-goal";
import { formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * B8の画面上部に出す参考表示(docs/screen-requirements-fire-goal.md B8の表示項目)。
 *
 * 「現在有効な設定方式」は**保存済みの方式**であり、いま開いているタブではない。
 * タブを切り替えただけで表示が変わると、保存前の状態が保存済みの設定に見えてしまうため。
 *
 * 現在資産額はB2で取り込んだ資産残高の最新値をそのまま出す参考値で、入力項目ではない。
 */
export const FireGoalSummary = ({
  savedMode,
  currentAssetTotal,
}: FireGoalSummaryProps): JSX.Element => {
  const modeLabel =
    FIRE_GOAL_MODES.find((mode) => mode.id === savedMode)?.label ?? FIRE_GOAL_UNSET_MODE_LABEL;

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{FIRE_GOAL_ACTIVE_MODE_LABEL}</dt>
            <dd className="font-semibold">{modeLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {FIRE_GOAL_CURRENT_ASSET_LABEL}
              {FIRE_GOAL_REFERENCE_SUFFIX}
            </dt>
            <dd className="font-semibold tabular-nums">
              {currentAssetTotal === null
                ? FIRE_GOAL_UNKNOWN_ASSET_LABEL
                : formatJpy(currentAssetTotal)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};
