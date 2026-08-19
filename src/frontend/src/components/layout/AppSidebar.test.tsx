import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import type { JSX } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

/*
  `useIsMobile`はmatchMedia/innerWidthから判定するため、ここでは判定結果のフックだけ
  差し替える(FireProgressGauge.test.tsxのmatchMediaスタブとは別の切り口)。
  SP幅ではshadcn/uiの`Sidebar`がSheet(ハンバーガーメニュー)に切り替わる
*/
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

const renderMobileSidebar = (): JSX.Element => (
  <SidebarProvider>
    <SidebarTrigger />
    <AppSidebar />
  </SidebarProvider>
);

describe("AppSidebar", () => {
  describe("SP幅のナビゲーションドロワー(Trelloカード Y-01)", () => {
    it("ナビゲーションリンクを押して遷移したら、開いているドロワーを閉じる", async () => {
      const user = userEvent.setup();
      render(renderMobileSidebar());

      await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "ダッシュボード" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    /*
      claude-reviewの指摘(PR #188)。`SidebarHeader`もSP幅では`SidebarContent`と同じ
      Sheet内に描画されるため、ナビゲーション項目だけに閉じる処理を付けると、
      ロゴ/アプリ名リンク経由の遷移だけ「開きっぱなし」が残っていた。
    */
    it("ロゴ/アプリ名リンクを押して遷移したときも、開いているドロワーを閉じる", async () => {
      const user = userEvent.setup();
      render(renderMobileSidebar());

      await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "FIRE-FIRE" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
