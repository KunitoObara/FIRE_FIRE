import { Card, CardContent } from "@/components/ui/card";
import {
  FIRE_GOAL_ACTIVE_MODE_LABEL,
  FIRE_GOAL_CURRENT_ASSET_LABEL,
  FIRE_GOAL_MODES,
  FIRE_GOAL_REFERENCE_SUFFIX,
  FIRE_GOAL_UNKNOWN_ASSET_LABEL,
  FIRE_GOAL_UNSET_MODE_LABEL,
  NEGATIVE_CURRENT_ASSET_NOTICE,
} from "@/constants/fire-goal";
import { formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * B8の画面上部に出す参考表示(docs/screen-requirements-fire-goal.md B8の表示項目)。
 *
 * 「現在有効な設定方式」は**保存済みの方式**であり、いま開いているタブではない。
 * タブを切り替えただけで表示が変わると、保存前の状態が保存済みの設定に見えてしまうため。
 *
 * 現在資産額はB2で取り込んだ資産残高を**達成度の対象分類で集計した**参考値で、入力項目では
 * ない。B1のゲージと同じ値・同じ表記にするため対象分類名を併記する(要件B8)。
 *
 * 設定方式と違い、対象分類は**選択中(未保存)の値**に追従させる。目標額の達成率ヒントが
 * 入力中の値で更新されるのと同じ扱いで、「この分類にすると達成率がこうなる」を保存前に
 * 確かめられるようにするため。
 */
export const FireGoalSummary = ({
  savedMode,
  currentAssetTotal,
  achievementAxisName,
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
            <dd className="self-center text-xs text-muted-foreground">({achievementAxisName})</dd>
          </div>
        </dl>

        {/*
          対象分類の負債が資産を上回ると現在資産額がマイナスになる。金額はマイナスのまま
          出したうえで、B1のゲージが達成率を0%に丸めることをここでも伝える。丸め方の正は
          docs/screen-requirements-dashboard.md B1で、この画面で別に決めない
          (同じ設定に対して画面ごとに違う達成率が出るのを避けるため)
        */}
        {currentAssetTotal !== null && currentAssetTotal < 0 ? (
          <p role="status" className="mt-2 text-xs text-destructive">
            {NEGATIVE_CURRENT_ASSET_NOTICE}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
