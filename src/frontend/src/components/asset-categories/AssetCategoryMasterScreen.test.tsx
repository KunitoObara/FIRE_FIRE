import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetCategoryMasterScreen } from "@/components/asset-categories/AssetCategoryMasterScreen";

import type { JSX } from "react";

const fetchCategoryAxes = vi.fn();
const fetchAssetTypeOptions = vi.fn();
const createCategoryAxis = vi.fn();
const updateCategoryAxis = vi.fn();
const deleteCategoryAxis = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: (...args: unknown[]) => fetchCategoryAxes(...args),
  fetchAssetTypeOptions: (...args: unknown[]) => fetchAssetTypeOptions(...args),
  createCategoryAxis: (...args: unknown[]) => createCategoryAxis(...args),
  updateCategoryAxis: (...args: unknown[]) => updateCategoryAxis(...args),
  deleteCategoryAxis: (...args: unknown[]) => deleteCategoryAxis(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const TOTAL_ASSETS_AXIS: AssetCategoryAxisDocument = {
  id: "total-assets",
  name: "総資産",
  assetTypeNames: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NET_FINANCIAL_AXIS: AssetCategoryAxisDocument = {
  id: "net-financial",
  name: "純金融資産",
  assetTypeNames: ["預金・現金", "投資信託"],
  createdAt: "2026-01-02T00:00:00.000Z",
};

/** `useQuery`を使うため、テストでも`QueryClientProvider`で包む必要がある */
const renderScreen = (): JSX.Element =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AssetCategoryMasterScreen />
    </QueryClientProvider>,
  );

describe("AssetCategoryMasterScreen", () => {
  beforeEach(() => {
    fetchCategoryAxes.mockReset();
    fetchAssetTypeOptions.mockReset();
    createCategoryAxis.mockReset();
    updateCategoryAxis.mockReset();
    deleteCategoryAxis.mockReset();
    toastSuccess.mockReset();

    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [TOTAL_ASSETS_AXIS, NET_FINANCIAL_AXIS] });
    fetchAssetTypeOptions.mockResolvedValue({
      ok: true,
      assetTypeNames: ["預金・現金", "投資信託", "株式(現物)"],
    });
  });

  it("登録済みの分類軸を一覧表示する", async () => {
    renderScreen();

    expect(await screen.findByText("総資産")).toBeInTheDocument();
    expect(screen.getByText("すべての資産種別が対象")).toBeInTheDocument();
    expect(screen.getByText("純金融資産")).toBeInTheDocument();
    expect(screen.getByText("預金・現金、投資信託")).toBeInTheDocument();
  });

  it("分類軸が1つも無い場合は登録を促す案内を出す", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    renderScreen();

    expect(await screen.findByText(/分類軸がまだ登録されていません/u)).toBeInTheDocument();
  });

  it("新規分類を追加して保存すると、一覧を取り直して完了を通知する", async () => {
    const user = userEvent.setup();
    createCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "生活防衛資金");
    await user.click(screen.getByLabelText("預金・現金"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith({
        name: "生活防衛資金",
        assetTypeNames: ["預金・現金"],
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("分類を追加しました");
    // 保存後はフォームを閉じる
    expect(screen.queryByLabelText("分類名")).not.toBeInTheDocument();
  });

  it("分類名が空のまま保存しようとするとエラーを出し、保存処理を呼ばない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("分類名を1〜40文字で入力してください");
    expect(createCategoryAxis).not.toHaveBeenCalled();
  });

  it("編集フォームには既存の値が入っており、保存すると更新する", async () => {
    const user = userEvent.setup();
    updateCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    const row = (await screen.findByText("純金融資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "編集" }));

    const nameInput = screen.getByLabelText("分類名");
    expect(nameInput).toHaveValue("純金融資産");
    expect(screen.getByLabelText("預金・現金")).toBeChecked();
    expect(screen.getByLabelText("株式(現物)")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateCategoryAxis).toHaveBeenCalledWith("net-financial", {
        name: "純金融資産",
        assetTypeNames: ["預金・現金", "投資信託"],
      });
    });
  });

  it("集計対象が割り当てられた分類の削除はブロックし、理由を表示する", async () => {
    const user = userEvent.setup();
    renderScreen();

    const row = (await screen.findByText("純金融資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.getByText(/先に紐づく資産種別の割り当てを解除してください/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
    expect(deleteCategoryAxis).not.toHaveBeenCalled();
  });

  it("集計対象が無い分類は確認のうえ削除でき、一覧を取り直して完了を通知する", async () => {
    const user = userEvent.setup();
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    const row = (await screen.findByText("総資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
    expect(toastSuccess).toHaveBeenCalledWith("分類を削除しました");
  });
});
