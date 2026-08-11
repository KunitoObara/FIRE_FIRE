import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardFilters } from "@/components/dashboard/DashboardFilters";

const replace = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const axes: AssetCategoryAxis[] = [
  { id: "total-assets", name: "総資産" },
  { id: "investment-assets", name: "投資性資産" },
];

const renderFilters = (props: Partial<DashboardFiltersProps> = {}): void => {
  render(
    <DashboardFilters
      axes={axes}
      selectedAxisId="total-assets"
      selectedPeriodId="1y"
      selectedTrendMode="stacked"
      {...props}
    />,
  );
};

describe("DashboardFilters", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("選択中の分類軸と期間を表示する", () => {
    renderFilters();

    expect(screen.getByLabelText("分類軸")).toHaveTextContent("総資産");
    expect(screen.getByRole("tab", { name: "1年" })).toHaveAttribute("aria-selected", "true");
  });

  it("「CSVを取り込む」からB2へ遷移できる", () => {
    renderFilters();

    expect(screen.getByRole("link", { name: "CSVを取り込む" })).toHaveAttribute(
      "href",
      "/csv-import",
    );
  });

  /**
   * 選択状態はURLに持たせる(CODING_STANDARDS.md 2章)。片方を変えても
   * もう片方の選択が落ちないことを、生成されるURLで確かめる。
   */
  it("期間を切り替えると、分類軸を保ったままURLを差し替える", async () => {
    const user = userEvent.setup();
    renderFilters({ selectedAxisId: "investment-assets" });

    await user.click(screen.getByRole("tab", { name: "3年" }));

    expect(replace).toHaveBeenCalledWith(
      "/dashboard?axis=investment-assets&period=3y&trend=stacked",
    );
  });

  it("分類軸を切り替えると、期間を保ったままURLを差し替える", async () => {
    const user = userEvent.setup();
    renderFilters({ selectedPeriodId: "5y" });

    await user.click(screen.getByLabelText("分類軸"));
    await user.click(screen.getByRole("option", { name: "投資性資産" }));

    expect(replace).toHaveBeenCalledWith(
      "/dashboard?axis=investment-assets&period=5y&trend=stacked",
    );
  });

  it("分類軸が1つも無ければセレクタを操作できない", () => {
    renderFilters({ axes: [], selectedAxisId: "" });

    expect(screen.getByLabelText("分類軸")).toBeDisabled();
  });
});
