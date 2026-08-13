import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateNewScreen } from "@/components/real-estate/RealEstateNewScreen";

import type { RenderResult } from "@testing-library/react";

const createRealEstateProperty = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/real-estate/property-repository", () => ({
  createRealEstateProperty: (...args: unknown[]) => createRealEstateProperty(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RealEstateNewScreen />
    </QueryClientProvider>,
  );

/** 必須項目だけを埋める(所在地は任意、収益物件はオフのまま) */
const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.type(screen.getByLabelText("物件名"), "□□戸建て");
  await user.type(screen.getByLabelText("時価(円)"), "18000000");
  await user.type(screen.getByLabelText("ローン残高(円)"), "0");
};

describe("RealEstateNewScreen", () => {
  beforeEach(() => {
    createRealEstateProperty.mockReset();
    push.mockReset();
    toastSuccess.mockReset();
  });

  it("保存に成功すると、登録した物件のB6へ遷移して完了を通知する", async () => {
    const user = userEvent.setup();
    createRealEstateProperty.mockResolvedValue({ ok: true, id: "chiba-house" });
    renderScreen();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createRealEstateProperty).toHaveBeenCalledWith({
        name: "□□戸建て",
        location: "",
        acquiredOn: null,
        marketValue: 18_000_000,
        loanBalance: 0,
        rental: null,
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("物件を登録しました");
    expect(push).toHaveBeenCalledWith("/real-estate/chiba-house");
  });

  it("保存に失敗したら遷移しない", async () => {
    const user = userEvent.setup();
    createRealEstateProperty.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("キャンセルは遷移元のB5に戻る", () => {
    renderScreen();

    expect(screen.getByRole("link", { name: "キャンセル" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
  });
});
