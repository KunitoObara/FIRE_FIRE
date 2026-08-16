"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CSV_IMPORT_LINK, DASHBOARD_PERIODS } from "@/constants/dashboard";
import { buildDashboardHref } from "@/lib/dashboard/filters";

import type { JSX } from "react";

const AXIS_SELECT_ID = "dashboard-axis";

/**
 * 分類軸・表示期間の切替(B1の入力項目)と、B2 CSV取込画面への導線。
 *
 * 選択状態はURLのクエリパラメータに持たせる。ローカルstateに閉じ込めると、リンク共有や
 * ブラウザの戻る/進むで同じ表示を再現できなくなるため(CODING_STANDARDS.md 2章)。
 * 遷移は同じ画面内のクエリの付け替えなので`replace`を使い、切替のたびに履歴を積まない。
 */
export const DashboardFilters = ({
  axes,
  selectedAxisId,
  selectedPeriodId,
  selectedTrendMode,
  selectedMonth,
}: DashboardFiltersProps): JSX.Element => {
  const router = useRouter();

  const handleAxisChange = (axisId: string): void => {
    router.replace(
      buildDashboardHref({
        axisId,
        periodId: selectedPeriodId,
        trendMode: selectedTrendMode,
        month: selectedMonth,
      }),
    );
  };

  const handlePeriodChange = (periodId: string): void => {
    router.replace(
      buildDashboardHref({
        axisId: selectedAxisId,
        periodId: periodId as DashboardPeriodId,
        trendMode: selectedTrendMode,
        month: selectedMonth,
      }),
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={AXIS_SELECT_ID} className="text-sm text-muted-foreground">
          分類軸
        </Label>
        <Select
          value={selectedAxisId}
          onValueChange={handleAxisChange}
          disabled={axes.length === 0}
        >
          <SelectTrigger id={AXIS_SELECT_ID} size="sm" className="w-44">
            <SelectValue placeholder="分類軸を選択" />
          </SelectTrigger>
          <SelectContent>
            {axes.map((axis) => (
              <SelectItem key={axis.id} value={axis.id}>
                {axis.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <Tabs value={selectedPeriodId} onValueChange={handlePeriodChange}>
          <TabsList aria-label="表示期間">
            {DASHBOARD_PERIODS.map((period) => (
              <TabsTrigger key={period.id} value={period.id}>
                {period.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button asChild size="sm">
          <Link href={CSV_IMPORT_LINK.href}>{CSV_IMPORT_LINK.label}</Link>
        </Button>
      </div>
    </div>
  );
};
