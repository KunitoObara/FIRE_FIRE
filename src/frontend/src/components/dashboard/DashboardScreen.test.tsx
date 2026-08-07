import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "@/components/dashboard/DashboardScreen";

import type { RenderResult } from "@testing-library/react";

const fetchDashboardData = vi.fn();
const replace = vi.fn<(href: string) => void>();

vi.mock("@/lib/dashboard/dashboard-data", () => ({
  fetchDashboardData: () => fetchDashboardData(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/** 資産推移・内訳のグラフはブラウザ専用(next/dynamic)なので、ここでは描画対象にしない */
vi.mock("@/components/dashboard/NetWorthTrendChart", () => ({
  NetWorthTrendChart: () => <div data-testid="net-worth-trend-chart" />,
}));

vi.mock("@/components/dashboard/CategoryBreakdownChart", () => ({
  CategoryBreakdownChart: () => <div data-testid="category-breakdown-chart" />,
}));

const data: DashboardData = {
  lastImportedAt: "2026-08-05T03:00:00.000Z",
  axes: [
    { id: "total", name: "総資産" },
    { id: "investment", name: "投資性資産" },
  ],
  categories: [
    { id: "株式(現物)", name: "株式(現物)" },
    { id: "投資信託", name: "投資信託" },
    { id: "預金・現金", name: "預金・現金" },
  ],
  byAxis: {
    total: {
      netWorthSeries: [{ date: "2026-08-05", amount: 11_400_000 }],
      breakdown: [
        { categoryId: "株式(現物)", amount: 5_400_000 },
        { categoryId: "投資信託", amount: 1_600_000 },
        { categoryId: "預金・現金", amount: 4_400_000 },
      ],
    },
    investment: {
      netWorthSeries: [{ date: "2026-08-05", amount: 7_000_000 }],
      breakdown: [
        { categoryId: "株式(現物)", amount: 5_400_000 },
        { categoryId: "投資信託", amount: 1_600_000 },
      ],
    },
  },
  fireProgress: {
    targetAmount: 80_000_000,
    currentAmount: 11_400_000,
    projectedAchievementDate: null,
  },
  cashflow: null,
};

/**
 * リトライはここでは切らない。画面側が`retry: false`を指定しており、既定のまま包んでも
 * 失敗のテストが指数バックオフで待たされないことを、この形のまま確かめられる
 */
const renderScreen = (props: Partial<DashboardScreenProps> = {}): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DashboardScreen axisParam={undefined} periodParam={undefined} {...props} />
    </QueryClientProvider>,
  );

describe("DashboardScreen", () => {
  beforeEach(() => {
    fetchDashboardData.mockReset();
    replace.mockReset();

    fetchDashboardData.mockResolvedValue({ ok: true, data });
  });

  it("直近CSV取込日時と、選択中の分類軸の推移・内訳・FIRE達成度を出す", async () => {
    renderScreen();

    expect(await screen.findByText("2026/08/05 12:00")).toBeInTheDocument();
    expect(screen.getByText("資産推移(総資産)")).toBeInTheDocument();
    expect(screen.getByText("分類別内訳(総資産)")).toBeInTheDocument();
    expect(screen.getByText("¥ 80,000,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 11,400,000")).toBeInTheDocument();
  });

  /** 分類軸の切り替えは資産推移グラフと分類別内訳の両方に及ぶ(要件B1) */
  it("URLで指定された分類軸の集計を、推移と内訳の両方に反映する", async () => {
    renderScreen({ axisParam: "investment" });

    expect(await screen.findByText("資産推移(投資性資産)")).toBeInTheDocument();
    expect(screen.getByText("分類別内訳(投資性資産)")).toBeInTheDocument();
    expect(screen.getByText("¥ 5,400,000")).toBeInTheDocument();
    expect(screen.queryByText("¥ 4,400,000")).not.toBeInTheDocument();
  });

  it("URLの分類軸が存在しないものなら先頭の分類軸に落とす", async () => {
    renderScreen({ axisParam: "deleted-axis" });

    expect(await screen.findByText("資産推移(総資産)")).toBeInTheDocument();
  });

  /** 期間の絞り込みは実行時の現在日時が基準。1年より前の点しか無ければ推移は空になる */
  it("表示期間の範囲外の推移しか無ければ、グラフの代わりにB2への導線を出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: {
        ...data,
        byAxis: {
          ...data.byAxis,
          total: {
            netWorthSeries: [{ date: "2000-01-31", amount: 1_000_000 }],
            breakdown: data.byAxis.total?.breakdown ?? [],
          },
        },
      },
    });
    renderScreen({ axisParam: "total", periodParam: "1y" });

    expect(
      await screen.findByText(
        "資産残高のデータがまだありません。CSVを取り込むと推移が表示されます。",
      ),
    ).toBeInTheDocument();
  });

  it("分類軸が1件も無ければB4への導線を出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: { ...data, axes: [], byAxis: {} },
    });
    renderScreen();

    expect(
      await screen.findByText(
        "分類軸が登録されていません。資産分類マスタで分類軸を追加してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "資産分類を設定する" })).toHaveAttribute(
      "href",
      "/asset-categories",
    );
    expect(screen.queryByText("分類別内訳(総資産)")).not.toBeInTheDocument();
  });

  /**
   * FIRE達成度は目標資産額との比較で、分類軸を参照しない(要件B1)。
   * ゲージごと消えるとB8への導線も一緒に失われるので、リンクの有無まで見る
   */
  it("分類軸が1件も無くてもFIRE達成度は出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: { ...data, axes: [], byAxis: {} },
    });
    renderScreen();

    expect(await screen.findByText("FIRE達成度")).toBeInTheDocument();
    expect(screen.getByText("¥ 80,000,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 11,400,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "目標を設定する" })).toHaveAttribute(
      "href",
      "/fire-goal",
    );
  });

  it("CSV未取込なら取込日時の代わりにその旨を出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: { ...data, lastImportedAt: null },
    });
    renderScreen();

    expect(await screen.findByText("CSV未取込")).toBeInTheDocument();
  });

  /** データはあるのに「まだありません」と読める表示にしない */
  it("取得に失敗したら空状態ではなくエラーを出す", async () => {
    fetchDashboardData.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "このデータの参照が許可されていません。ログインし直してください。",
    );
    expect(screen.queryByText("資産推移(総資産)")).not.toBeInTheDocument();
  });

  /**
   * 取得後の集計はリポジトリのtry/catchの外で走るので、壊れたデータが混じると
   * `ok: false`ではなく例外になる。何も出ないまま終わらせない
   */
  it("取得が例外で落ちたらメッセージと再試行の導線を出す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchDashboardData.mockRejectedValue(new Error("Invalid time value"));
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "データを表示できませんでした。再試行しても直らない場合は、取り込んだCSVのデータに問題がある可能性があります。",
    );
    expect(screen.getByRole("button", { name: "再試行する" })).toBeEnabled();
    // 画面の文言では原因まで辿れないので、開発者向けの手掛かりを残す
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("「再試行する」で取得をやり直し、成功すれば表示に切り替わる", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    fetchDashboardData.mockRejectedValueOnce(new Error("Invalid time value"));
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "再試行する" }));

    expect(await screen.findByText("資産推移(総資産)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  /** 取得失敗(`ok: false`)も、リロード以外の回復手段が無い状態にはしない */
  it("取得に失敗したときも再試行できる", async () => {
    const user = userEvent.setup();
    fetchDashboardData.mockResolvedValueOnce({ ok: false, reason: "unknown" });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "再試行する" }));

    expect(await screen.findByText("資産推移(総資産)")).toBeInTheDocument();
  });

  it("分類軸を切り替えるとURLのクエリを差し替える", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByLabelText("分類軸"));
    await user.click(await screen.findByRole("option", { name: "投資性資産" }));

    expect(replace).toHaveBeenCalledWith("/dashboard?axis=investment&period=1y");
  });
});
