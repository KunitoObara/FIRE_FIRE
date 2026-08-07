import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateDetailScreen } from "@/components/real-estate/RealEstateDetailScreen";

import type { RenderResult } from "@testing-library/react";

const fetchRealEstateProperty = vi.fn();

vi.mock("@/lib/real-estate/property-repository", () => ({
  fetchRealEstateProperty: (...args: unknown[]) => fetchRealEstateProperty(...args),
}));

const PROPERTY: RealEstateProperty = {
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  updatedAt: "2026-06-01",
};

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RealEstateDetailScreen propertyId="shibuya-101" />
    </QueryClientProvider>,
  );

describe("RealEstateDetailScreen", () => {
  beforeEach(() => {
    fetchRealEstateProperty.mockReset();
    fetchRealEstateProperty.mockResolvedValue({ ok: true, property: PROPERTY });
  });

  it("物件の詳細と編集への導線を表示する", async () => {
    renderScreen();

    // 物件名は見出しと物件基本情報の両方に出るため、見出しで絞る
    expect(
      await screen.findByRole("heading", { name: "〇〇マンション101号室" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute(
      "href",
      "/real-estate/shibuya-101/edit",
    );
  });

  /** 削除済みの物件をブックマークから開いた場合(docs/screen-requirements-real-estate.md B6) */
  it("物件が存在しない場合は案内と一覧への導線を出す", async () => {
    fetchRealEstateProperty.mockResolvedValue({ ok: true, property: null });
    renderScreen();

    expect(await screen.findByText("物件が見つかりません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "一覧に戻る" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
  });

  it("取得に失敗した場合は失敗の理由を出す", async () => {
    fetchRealEstateProperty.mockResolvedValue({ ok: false, reason: "configuration-error" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Firebaseの設定が読み込めないため操作できません。",
    );
    expect(screen.queryByText("物件が見つかりません")).not.toBeInTheDocument();
  });
});
