"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { APP_NAME, findPrimaryNavItem } from "@/constants/navigation";
import { ACCOUNT_SETTINGS_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * ログイン後の共通ヘッダー(DESIGN.md 5章)。
 *
 * 見出しは現在のパスから引く。サイドバーに出さない画面(B6・B7)ではアプリ名に落とす。
 * スマートフォン幅ではサイドバーが隠れるため、開閉ボタン(`SidebarTrigger`)を左端に置く。
 */
export const AppHeader = (): JSX.Element => {
  const pathname = usePathname();
  const currentItem = findPrimaryNavItem(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <h1 className="text-base font-semibold">{currentItem?.label ?? APP_NAME}</h1>
      <Link
        href={ACCOUNT_SETTINGS_PATH}
        aria-label="アカウント設定"
        className="ml-auto rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-muted-foreground">
            <UserRound className="size-4" aria-hidden />
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
};
