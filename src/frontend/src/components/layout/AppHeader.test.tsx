import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/layout/AppHeader";
import { SidebarProvider } from "@/components/ui/sidebar";

import type { JSX } from "react";

const replace = vi.fn();
const getFirebaseAuth = vi.fn<() => { currentUser: { email: string | null } | null }>();
const performSignOut = vi.fn<(clearQueryCache?: () => void) => Promise<SignOutResult>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseAuth: () => getFirebaseAuth(),
}));

vi.mock("@/lib/auth/sign-out", () => ({
  performSignOut: (clearQueryCache?: () => void) => performSignOut(clearQueryCache),
}));

/** `AppHeader`が要求する外側のプロバイダ(サイドバーの開閉状態・TanStack Query)を用意する */
const renderHeader = (queryClient: QueryClient): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <SidebarProvider>
      <AppHeader />
    </SidebarProvider>
  </QueryClientProvider>
);

const openUserMenu = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole("button", { name: "ユーザーメニュー" }));
};

describe("AppHeader", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    replace.mockReset();
    getFirebaseAuth.mockReset();
    getFirebaseAuth.mockReturnValue({ currentUser: { email: "user@example.com" } });
    performSignOut.mockReset();
    performSignOut.mockResolvedValue({ ok: true });
  });

  describe("ユーザーメニュー(docs/screen-requirements-account.md 2章)", () => {
    it("ログイン中のメールアドレスとアカウント設定・ログアウトを表示する", async () => {
      const user = userEvent.setup();
      render(renderHeader(queryClient));

      await openUserMenu(user);

      expect(screen.getByText("user@example.com")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /アカウント設定/ })).toHaveAttribute(
        "href",
        "/account",
      );
      expect(screen.getByRole("menuitem", { name: /ログアウト/ })).toBeInTheDocument();
    });

    it("メールアドレスが取得できない場合もメニュー自体は表示する", async () => {
      getFirebaseAuth.mockReturnValue({ currentUser: null });
      const user = userEvent.setup();
      render(renderHeader(queryClient));

      await openUserMenu(user);

      expect(screen.getByRole("menuitem", { name: /ログアウト/ })).toBeInTheDocument();
    });
  });

  describe("ログアウト", () => {
    it("押下で確認ダイアログを開く", async () => {
      const user = userEvent.setup();
      render(renderHeader(queryClient));

      await openUserMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /ログアウト/ }));

      expect(screen.getByRole("heading", { name: "ログアウトしますか?" })).toBeInTheDocument();
      expect(
        screen.getByText(
          "次回のログインでは、パスワードに加えて認証アプリの確認コードの入力が必要です。",
        ),
      ).toBeInTheDocument();
    });

    it("「ログアウトする」でTanStack Queryのキャッシュを初期化してから実行し、A4へ遷移する", async () => {
      const clearSpy = vi.spyOn(queryClient, "clear");
      performSignOut.mockImplementation(async (clearQueryCache) => {
        clearQueryCache?.();
        return { ok: true };
      });
      const user = userEvent.setup();
      render(renderHeader(queryClient));

      await openUserMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /ログアウト/ }));
      await user.click(screen.getByRole("button", { name: "ログアウトする" }));

      expect(performSignOut).toHaveBeenCalledTimes(1);
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/login");
    });

    it("「キャンセル」ではログアウトしない", async () => {
      const user = userEvent.setup();
      render(renderHeader(queryClient));

      await openUserMenu(user);
      await user.click(screen.getByRole("menuitem", { name: /ログアウト/ }));
      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(performSignOut).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
