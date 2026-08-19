"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_NAME, PRIMARY_NAV_GROUPS } from "@/constants/navigation";
import { DASHBOARD_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * ログイン後の共通サイドバー(DESIGN.md 5章)。
 *
 * 主要画面へは常時1クリックで到達できる必要があるため、項目は折り畳まずに全て並べる。
 * スマートフォン幅では shadcn/ui の`Sidebar`がSheet(ハンバーガーメニュー)に切り替わる。
 *
 * 並べる項目は`src/constants/navigation.ts`に集約してあり、ここには持たない。
 */
export const AppSidebar = (): JSX.Element => {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  /*
    SP幅(Sheetに切り替わったドロワー)でリンクを押して遷移したら、ドロワーを閉じる
    (Trelloカード Y-01「開きっぱなし」)。PC幅の常時表示サイドバーは`isMobile`が
    falseなので何もしない — 閉じる/開くという概念が無いこちらの挙動は変えない。
  */
  const handleNavigate = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-15 justify-center border-b px-4">
        <Link href={DASHBOARD_PATH} className="text-sm font-bold">
          {APP_NAME}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {PRIMARY_NAV_GROUPS.map((group, index) => (
          <SidebarGroup key={group.id} className="py-0">
            {index > 0 ? <SidebarSeparator className="mb-2" /> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.screenId}>
                    <SidebarMenuButton asChild isActive={pathname === item.path}>
                      <Link href={item.path} onClick={handleNavigate}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
