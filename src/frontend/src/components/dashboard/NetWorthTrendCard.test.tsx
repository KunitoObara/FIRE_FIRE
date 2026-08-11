import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NetWorthTrendCard } from "@/components/dashboard/NetWorthTrendCard";
import { STACKED_DEBT_NOT_DEDUCTED_NOTICE } from "@/constants/dashboard";

const replace = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/** グラフはブラウザ専用(next/dynamic)なので、ここでは中身を描画対象にしない */
vi.mock("@/components/dashboard/NetWorthTrendChart", () => ({
  NetWorthTrendChart: () => <div data-testid="net-worth-trend-chart" />,
}));

vi.mock("@/components/dashboard/NetWorthStackedChart", () => ({
  NetWorthStackedChart: () => <div data-testid="net-worth-stacked-chart" />,
}));

const categories: AssetCategory[] = [
  { id: "投資信託", name: "投資信託" },
  { id: "預金・現金", name: "預金・現金" },
];

const series: NetWorthPoint[] = [
  {
    date: "2026-08-05",
    amount: 5_000_000,
    byType: { 投資信託: 3_000_000, "預金・現金": 2_000_000 },
  },
];

const renderCard = (props: Partial<NetWorthTrendCardProps> = {}): void => {
  render(
    <NetWorthTrendCard
      axisName="総資産"
      series={series}
      mode="stacked"
      categories={categories}
      debtTotal={0}
      buildHref={(mode) => `/dashboard?trend=${mode}`}
      {...props}
    />,
  );
};

describe("NetWorthTrendCard", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("見出しに選択中の分類軸名を添える", () => {
    renderCard();

    expect(screen.getByText("資産推移(総資産)")).toBeInTheDocument();
  });

  /** 既定は積み上げ(docs/screen-requirements-dashboard.md B1) */
  it("積み上げ表示では積み上げグラフと凡例を出す", async () => {
    renderCard();

    // グラフは`next/dynamic`で遅れて差し込まれるので、出そろうまで待つ
    expect(await screen.findByTestId("net-worth-stacked-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("net-worth-trend-chart")).not.toBeInTheDocument();
    expect(screen.getByText("投資信託")).toBeInTheDocument();
    expect(screen.getByText("預金・現金")).toBeInTheDocument();
  });

  /** 純資産表示は1系列なので凡例を置かない */
  it("純資産表示では折れ線グラフに切り替わり、凡例を出さない", async () => {
    renderCard({ mode: "net" });

    expect(await screen.findByTestId("net-worth-trend-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("net-worth-stacked-chart")).not.toBeInTheDocument();
    expect(screen.queryByText("投資信託")).not.toBeInTheDocument();
  });

  /**
   * 選択状態はURLに載せる。ローカルstateに閉じ込めるとリンク共有・戻る/進むで再現できない
   * (src/frontend/docs/CODING_STANDARDS.md 2章)。
   */
  it("表示を切り替えるとURLを差し替える", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("tab", { name: "純資産" }));

    expect(replace).toHaveBeenCalledWith("/dashboard?trend=net");
  });

  /**
   * 隣の円グラフは負債のスライスと差引後の純額を出しているので、注記が無いと同じ画面の
   * 2つのグラフが同じ分類軸について違う合計を示しているように見える(同要件B1)。
   */
  it("負債を含む分類軸の積み上げ表示に、負債を差し引いていない旨を出す", () => {
    renderCard({ debtTotal: 2_000_000 });

    expect(screen.getByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).toBeInTheDocument();
  });

  it("純資産表示では負債の注記を出さない", () => {
    renderCard({ mode: "net", debtTotal: 2_000_000 });

    expect(screen.queryByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).not.toBeInTheDocument();
  });

  /** 0円の負債でスライスを出さないのと同じ理由 */
  it("差し引く残債が0円なら注記を出さない", () => {
    renderCard({ debtTotal: 0 });

    expect(screen.queryByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).not.toBeInTheDocument();
  });

  /** 切り替えてもどちらの表示も描くものが無いので、選ばせる意味が無い(同要件B1) */
  it("資産残高が1件も無ければ、切替を出さずB2への導線だけを出す", () => {
    renderCard({ series: [] });

    expect(screen.queryByRole("tab", { name: "純資産" })).not.toBeInTheDocument();
    expect(
      screen.getByText("資産残高のデータがまだありません。CSVを取り込むと推移が表示されます。"),
    ).toBeInTheDocument();
  });
});
