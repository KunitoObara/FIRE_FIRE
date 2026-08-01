"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { APP_NAME, findPrimaryNavItem } from "@/constants/navigation";
import { ACCOUNT_SETTINGS_PATH } from "@/constants/routes";
import { performSignOut } from "@/lib/auth/sign-out";
import { getFirebaseAuth } from "@/lib/firebase/client";

import type { JSX } from "react";

/**
 * ログイン後の共通ヘッダー(DESIGN.md 5章)。
 *
 * 見出しは現在のパスから引く。サイドバーに出さない画面(B6・B7)ではアプリ名に落とす。
 * スマートフォン幅ではサイドバーが隠れるため、開閉ボタン(`SidebarTrigger`)を左端に置く。
 *
 * 右端のアバターはB10へ直接リンクせず、ユーザーメニュー(ログイン中のメールアドレス・
 * アカウント設定・ログアウト)の起点にする(docs/screen-requirements-account.md 2章)。
 * `AppHeader`は`AppAccessGuard`がreadyと判定した後にしか描画されないため、
 * `getFirebaseAuth().currentUser`は必ずサインイン済みのユーザーを指す。
 */
export const AppHeader = (): JSX.Element => {
  const pathname = usePathname();
  const currentItem = findPrimaryNavItem(pathname);
  // ログアウト時にFirestoreの取得キャッシュを初期化するため(共有端末で前の利用者の
  // 資産額が残って見えるのを防ぐ)。QueryProviderの内側にあるため常に取得できる
  const queryClient = useQueryClient();

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const email = getFirebaseAuth().currentUser?.email ?? null;

  return (
    <header className="sticky top-0 z-10 flex h-15 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <h1 className="text-base font-semibold">{currentItem?.label ?? APP_NAME}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="ユーザーメニュー"
            className="ml-auto rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-muted-foreground">
                <UserRound className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* ログアウトの前に、どのアカウントでログインしているかを確かめられるようにする */}
          {email !== null ? (
            <DropdownMenuLabel className="font-normal break-all text-muted-foreground">
              {email}
            </DropdownMenuLabel>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href={ACCOUNT_SETTINGS_PATH}>
              <Settings aria-hidden />
              アカウント設定
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/*
            他の項目と見た目を区別する(account.md 2章)。ダイアログを開く前にRadixが
            トリガーへフォーカスを戻そうとして競合しないよう、既定の選択動作を止める
          */}
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setIsLogoutDialogOpen(true);
            }}
          >
            <LogOut aria-hidden />
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LogoutConfirmDialog
        variant="header"
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        onConfirm={() => performSignOut(() => queryClient.clear())}
      />
    </header>
  );
};
