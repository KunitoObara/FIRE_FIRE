import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { JSX } from "react";

/**
 * ウィジェットに表示するデータが無いときの中身。
 *
 * 単に「データがありません」で止めず、そのデータを用意する画面への導線を必ず添える。
 * B1はログイン直後の最初の画面であり、初回はほぼ全ウィジェットが空になるため。
 */
export const DashboardEmptyState = ({ message, action }: DashboardEmptyStateProps): JSX.Element => (
  <div className="flex flex-col items-start gap-3 py-6">
    <p className="text-sm text-muted-foreground">{message}</p>
    {action ? (
      <Button asChild variant="outline" size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    ) : null}
  </div>
);
