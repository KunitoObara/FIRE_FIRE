import { AppAccessGuard } from "@/components/layout/AppAccessGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import type { JSX } from "react";

/**
 * ログイン後の画面(B1〜B10)共通のシェル。
 * DESIGN.md 5章のとおり、共通ヘッダー+サイドバーの「ダッシュボードアプリ型」レイアウトとする。
 *
 * `AppAccessGuard`が判定を通すまで配下の画面は描画されない。`children`はサーバー側で
 * 組み立てた要素をそのまま渡すため、各画面をServer Componentのまま書ける。
 */
const DashboardLayout = ({ children }: AppShellProps): JSX.Element => (
  <AppAccessGuard>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  </AppAccessGuard>
);

export default DashboardLayout;
