import { AppAccessGuard } from "@/components/layout/AppAccessGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

import type { JSX } from "react";

/**
 * ログイン後の画面(B1〜B11)共通のシェル。
 * DESIGN.md 5章のとおり、共通ヘッダー+サイドバーの「ダッシュボードアプリ型」レイアウトとする。
 *
 * `AppAccessGuard`が判定を通すまで配下の画面は描画されない。`children`はサーバー側で
 * 組み立てた要素をそのまま渡すため、各画面をServer Componentのまま書ける。
 *
 * `Toaster`はCSV取込完了・保存完了などの一過性メッセージの出口(DESIGN.md 7章)。
 * 画面をまたいで1つあれば足りるのでここに置く。`QueryProvider`も同様で、Firestoreを
 * 引くのはログイン後の画面だけなのでこのシェルの内側に限る。
 */
const DashboardLayout = ({ children }: AppShellProps): JSX.Element => (
  <AppAccessGuard>
    <QueryProvider>
      <SidebarProvider>
        <AppSidebar />
        {/*
          `min-w-0`が無いと、サイドバーと横に並ぶこの領域が中身の最小幅より狭くならず、
          B2のCSVプレビュー表のような横に広い要素があると画面全体が横スクロールする。
          広い中身は、それぞれの`overflow-x-auto`の中だけでスクロールさせたい。
        */}
        <SidebarInset className="min-w-0">
          <AppHeader />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </QueryProvider>
  </AppAccessGuard>
);

export default DashboardLayout;
