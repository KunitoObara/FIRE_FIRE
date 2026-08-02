import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateListScreen } from "@/components/real-estate/RealEstateListScreen";

import type { RenderResult } from "@testing-library/react";

const fetchRealEstateProperties = vi.fn();

vi.mock("@/lib/real-estate/property-repository", () => ({
  fetchRealEstateProperties: (...args: unknown[]) => fetchRealEstateProperties(...args),
}));

const PROPERTIES: RealEstateProperty[] = [
  {
    id: "shibuya-101",
    name: "〇〇マンション101号室",
    location: "東京都渋谷区神南1-2-3",
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
    rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
    updatedAt: "2026-06-01",
  },
];

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RealEstateListScreen />
    </QueryClientProvider>,
  );

describe("RealEstateListScreen", () => {
  beforeEach(() => {
    fetchRealEstateProperties.mockReset();
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: PROPERTIES });
  });

  it("登録済みの物件を一覧表示する", async () => {
    renderScreen();

    expect(await screen.findByText("〇〇マンション101号室")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
      "href",
      "/real-estate/new",
    );
  });

  it("物件が1件も無い場合は登録を促す案内を出す", async () => {
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: [] });
    renderScreen();

    expect(await screen.findByText(/登録済みの物件がまだありません/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "物件を登録する" })).toBeInTheDocument();
  });

  /**
   * 取得に失敗したときに空状態を出すと、登録済みの物件があるのに「1件も無い」と読める
   * 表示になってしまう。失敗は失敗として出す。
   */
  it("取得に失敗した場合は空状態ではなく失敗の理由を出す", async () => {
    fetchRealEstateProperties.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この操作は許可されていません。ログインし直すか、画面を更新してください。",
    );
    expect(screen.queryByText(/登録済みの物件がまだありません/u)).not.toBeInTheDocument();
  });
});
