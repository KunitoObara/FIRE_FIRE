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
    debtBalance: 0,
  },
];

/** 負債を含む分類軸の推移。帯が0でない点があるので切替が出る(同要件B1) */
const seriesWithDebt: NetWorthPoint[] = [
  {
    date: "2026-08-05",
    amount: 3_000_000,
    byType: { 投資信託: 3_000_000, "預金・現金": 2_000_000 },
    debtBalance: 2_000_000,
  },
];

const renderCard = (props: Partial<NetWorthTrendCardProps> = {}): void => {
  render(
    <NetWorthTrendCard
      axisName="総資産"
      series={series}
      mode="with-debt"
      categories={categories}
      buildHref={(mode) => `/dashboard?debt=${mode}`}
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

  it("積み上げグラフと凡例を出す", async () => {
    renderCard();

    // グラフは`next/dynamic`で遅れて差し込まれるので、出そろうまで待つ
    expect(await screen.findByTestId("net-worth-stacked-chart")).toBeInTheDocument();
    expect(screen.getByText("投資信託")).toBeInTheDocument();
    expect(screen.getByText("預金・現金")).toBeInTheDocument();
  });

  /** 切替が動かすのは負債の有無だけで、積み上げそのものは切り替わらない(同要件B1) */
  it("資産のみに切り替えても積み上げグラフのまま", async () => {
    renderCard({ series: seriesWithDebt, mode: "assets-only" });

    expect(await screen.findByTestId("net-worth-stacked-chart")).toBeInTheDocument();
    expect(screen.getByText("投資信託")).toBeInTheDocument();
  });

  /** 負債の帯は資産種別の後ろに固定で並ぶ(同要件B1「積み上げ表示」) */
  it("負債反映ONでは凡例の末尾に負債を出す", () => {
    renderCard({ series: seriesWithDebt });

    const legend = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(legend).toEqual(["投資信託", "預金・現金", "負債"]);
  });

  it("資産のみでは凡例に負債を出さない", () => {
    renderCard({ series: seriesWithDebt, mode: "assets-only" });

    expect(screen.queryByText("負債")).not.toBeInTheDocument();
  });

  /**
   * 選択状態はURLに載せる。ローカルstateに閉じ込めるとリンク共有・戻る/進むで再現できない
   * (src/frontend/docs/CODING_STANDARDS.md 2章)。
   */
  it("切り替えるとURLを差し替える", async () => {
    const user = userEvent.setup();
    renderCard({ series: seriesWithDebt });

    await user.click(screen.getByRole("tab", { name: "資産のみ" }));

    expect(replace).toHaveBeenCalledWith("/dashboard?debt=assets-only");
  });

  /**
   * 隣の円グラフは負債のスライスと差引後の純額を出し続けるので、注記が無いと同じ画面の
   * 2つのグラフが同じ分類軸について違う合計を示しているように見える(同要件B1)。
   */
  it("資産のみのあいだは、負債を反映していない旨を出す", () => {
    renderCard({ series: seriesWithDebt, mode: "assets-only" });

    expect(screen.getByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).toBeInTheDocument();
  });

  it("負債反映ONでは注記を出さない", () => {
    renderCard({ series: seriesWithDebt });

    expect(screen.queryByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).not.toBeInTheDocument();
  });

  /**
   * 押しても何も変わらない切替は、負債を反映していないのか設定していないのかの区別を
   * 却って曖昧にする。判定は期間内の帯で行い、件数や直近の残債では行わない(同要件B1)
   */
  it("期間内に負債の帯が無ければ切替も注記も出さない", () => {
    renderCard({ mode: "assets-only" });

    expect(screen.queryByRole("tab", { name: "負債反映" })).not.toBeInTheDocument();
    expect(screen.queryByText(STACKED_DEBT_NOT_DEDUCTED_NOTICE)).not.toBeInTheDocument();
  });

  /** 切り替えても描くものが無いので、選ばせる意味が無い(同要件B1) */
  it("資産残高が1件も無ければ、切替を出さずB2への導線だけを出す", () => {
    renderCard({ series: [] });

    expect(screen.queryByRole("tab", { name: "負債反映" })).not.toBeInTheDocument();
    expect(
      screen.getByText("資産残高のデータがまだありません。CSVを取り込むと推移が表示されます。"),
    ).toBeInTheDocument();
  });
});
