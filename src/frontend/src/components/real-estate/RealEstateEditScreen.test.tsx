import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateEditScreen } from "@/components/real-estate/RealEstateEditScreen";

import type { RenderResult } from "@testing-library/react";

const fetchRealEstateProperty = vi.fn();
const updateRealEstateProperty = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/real-estate/property-repository", () => ({
  fetchRealEstateProperty: (...args: unknown[]) => fetchRealEstateProperty(...args),
  updateRealEstateProperty: (...args: unknown[]) => updateRealEstateProperty(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const RENTAL_PROPERTY: RealEstateProperty = {
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  acquiredOn: null,
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
  updatedAt: "2026-06-01",
  valueHistory: {},
};

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RealEstateEditScreen propertyId="shibuya-101" />
    </QueryClientProvider>,
  );

describe("RealEstateEditScreen", () => {
  beforeEach(() => {
    fetchRealEstateProperty.mockReset();
    updateRealEstateProperty.mockReset();
    push.mockReset();
    toastSuccess.mockReset();

    fetchRealEstateProperty.mockResolvedValue({ ok: true, property: RENTAL_PROPERTY });
  });

  it("既存の登録値をプリセットし、更新するとその物件のB6へ戻る", async () => {
    const user = userEvent.setup();
    updateRealEstateProperty.mockResolvedValue({ ok: true, id: "shibuya-101" });
    renderScreen();

    const marketValueInput = await screen.findByLabelText("時価(円)");
    expect(marketValueInput).toHaveValue("32000000");
    expect(screen.getByLabelText("物件名")).toHaveValue("〇〇マンション101号室");

    await user.clear(marketValueInput);
    await user.type(marketValueInput, "33500000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateRealEstateProperty).toHaveBeenCalledWith("shibuya-101", {
        name: "〇〇マンション101号室",
        location: "東京都渋谷区神南1-2-3",
        acquiredOn: null,
        marketValue: 33_500_000,
        loanBalance: 18_400_000,
        rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("物件情報を更新しました");
    expect(push).toHaveBeenCalledWith("/real-estate/shibuya-101");
  });

  it("キャンセルは遷移元のB6に戻る", async () => {
    renderScreen();

    expect(await screen.findByRole("link", { name: "キャンセル" })).toHaveAttribute(
      "href",
      "/real-estate/shibuya-101",
    );
  });

  /** 削除済みの物件をブックマークから開いた場合(docs/screen-requirements-real-estate.md B6) */
  it("物件が存在しない場合は案内と一覧への導線を出し、フォームを描かない", async () => {
    fetchRealEstateProperty.mockResolvedValue({ ok: true, property: null });
    renderScreen();

    expect(await screen.findByText("物件が見つかりません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "一覧に戻る" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
    expect(screen.queryByLabelText("物件名")).not.toBeInTheDocument();
  });

  /**
   * 取得の失敗を「物件が見つかりません」と表示しない。通信が復旧すれば見えるはずの物件を、
   * 消えたものと誤解させないため。
   */
  it("取得に失敗した場合は失敗の理由を出し、「物件が見つかりません」とは出さない", async () => {
    fetchRealEstateProperty.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログイン状態が切れています。ログインし直してから操作してください。",
    );
    expect(screen.queryByText("物件が見つかりません")).not.toBeInTheDocument();
  });
});
