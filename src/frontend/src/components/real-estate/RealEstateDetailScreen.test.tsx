import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateDetailScreen } from "@/components/real-estate/RealEstateDetailScreen";

import type { RenderResult } from "@testing-library/react";

const fetchRealEstateProperty = vi.fn();
const deleteRealEstateProperty = vi.fn();
const fetchCategoryAxes = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/real-estate/property-repository", () => ({
  fetchRealEstateProperty: (...args: unknown[]) => fetchRealEstateProperty(...args),
  deleteRealEstateProperty: (...args: unknown[]) => deleteRealEstateProperty(...args),
}));

// 削除の確認ダイアログが「この物件を集計対象にしている分類軸」を挙げるために読む(B6-1)
vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: (...args: unknown[]) => fetchCategoryAxes(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const PROPERTY: RealEstateProperty = {
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  acquiredOn: null,
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  updatedAt: "2026-06-01",
  valueHistory: {},
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
    deleteRealEstateProperty.mockReset();
    deleteRealEstateProperty.mockResolvedValue({ ok: true });
    fetchCategoryAxes.mockReset();
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    push.mockReset();
    toastSuccess.mockReset();
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
  /**
   * 削除に成功したらB5へ戻ってトーストで知らせる。**一覧のキャッシュも取り直す** —
   * 消したはずの物件が一覧に残っていると、削除できたのか判断できない
   * (docs/screen-requirements-real-estate.md「物件の削除」)。
   */
  it("削除に成功するとB5へ遷移して完了を通知する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteRealEstateProperty).toHaveBeenCalledWith("shibuya-101");
    });
    expect(toastSuccess).toHaveBeenCalledWith("物件を削除しました");
    expect(push).toHaveBeenCalledWith("/real-estate");
  });

  /** 分類軸は名前をすべて挙げる。どの軸の集計が変わるかをその場で確かめられるようにするため */
  it("この物件を集計対象にしている分類軸の名前を確認ダイアログに出す", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        {
          id: "total",
          name: "総資産",
          assetTypeNames: [],
          debtIds: [],
          propertyValuations: { "shibuya-101": "spread" },
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "financial",
          name: "純金融資産",
          assetTypeNames: [],
          debtIds: [],
          propertyValuations: {},
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText(/「総資産」の集計も変わります/u)).toBeInTheDocument();
    expect(screen.queryByText(/純金融資産/u)).not.toBeInTheDocument();
  });

  /**
   * 分類軸の取得に失敗しても削除は止めない(分類軸は影響の説明であって、削除の可否を
   * 決めるものではない)。確かめられなかったことはダイアログに出す。
   */
  it("分類軸を取得できなくても削除できる", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText(/確認できていません/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteRealEstateProperty).toHaveBeenCalledWith("shibuya-101");
    });
  });

  /** 失敗したらB6に留まる。遷移もトーストもしない */
  it("削除に失敗したら遷移せずエラーを出す", async () => {
    const user = userEvent.setup();
    deleteRealEstateProperty.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/この操作は許可されていません/u);
    expect(push).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
