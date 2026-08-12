import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CashflowSummaryCard } from "@/components/dashboard/CashflowSummaryCard";

import type { RenderResult } from "@testing-library/react";

const fetchCashflowData = vi.fn();
const onMonthChange = vi.fn<(month: string) => void>();

vi.mock("@/lib/dashboard/cashflow-data", () => ({
  fetchCashflowData: (...args: unknown[]) => fetchCashflowData(...args),
}));

/** 円グラフはブラウザ専用(next/dynamic)なので、ここでは描画対象にしない */
vi.mock("@/components/dashboard/ExpenseBreakdownChart", () => ({
  ExpenseBreakdownChart: ({ slices }: ExpenseBreakdownChartProps) => (
    <div data-testid="expense-breakdown-chart" data-slices={slices.length} />
  ),
}));

const cashflow: CashflowSummary = {
  month: "2026-08",
  income: 420_000,
  expense: 159_400,
  expenseByCategory: [
    { name: "住居費", amount: 97_000 },
    { name: "食費", amount: 62_400 },
  ],
};

/** 再レンダリングでキャッシュの効きを見るため、画面と同じインスタンスを掴んでおく */
let queryClient: QueryClient;

const renderCard = (props: Partial<CashflowSummaryCardProps> = {}): RenderResult => {
  queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <CashflowSummaryCard
        month="2026-08"
        maxMonth="2026-08"
        onMonthChange={onMonthChange}
        {...props}
      />
    </QueryClientProvider>,
  );
};

/**
 * 収支サマリのカード(docs/screen-requirements-dashboard.md B1「収支サマリ」)。
 *
 * 対象の月をカード自身が取得するので、**このカードだけが失敗しうる**。
 * 読み込み中・失敗(再試行)・空を別の表示にする(同要件「選択した年月にデータが無いとき」)。
 */
describe("CashflowSummaryCard", () => {
  beforeEach(() => {
    fetchCashflowData.mockReset();
    onMonthChange.mockReset();
    fetchCashflowData.mockResolvedValue({ ok: true, cashflow });
  });

  it("選択中の年月と、その月の収入・支出・収支・費目別支出を出す", async () => {
    renderCard();

    expect(await screen.findByText("¥ 420,000")).toBeInTheDocument();
    // 支出は絶対値、符号を持つのは収支だけ(同書5章)
    expect(screen.getByText("¥ 159,400")).toBeInTheDocument();
    expect(screen.getByText("+ ¥ 260,600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /対象の年月/ })).toHaveTextContent("2026年8月");
  });

  /**
   * 費目別支出は円グラフ+凡例で出し、凡例の並び(色見本・費目名・構成比・金額)は
   * 分類別内訳カードと同じにする(docs/screen-requirements-dashboard.md B1)
   */
  it("費目別支出を円グラフと凡例(費目名・構成比・金額)で出す", async () => {
    renderCard();

    expect(await screen.findByTestId("expense-breakdown-chart")).toHaveAttribute(
      "data-slices",
      "2",
    );
    expect(screen.getByText("住居費")).toBeInTheDocument();
    expect(screen.getByText("食費")).toBeInTheDocument();
    // 構成比の分母はその月の支出合計(97,000 + 62,400 = 159,400)
    expect(screen.getByText("61%")).toBeInTheDocument();
    expect(screen.getByText("39%")).toBeInTheDocument();
    expect(screen.getByText("¥ 97,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 62,400")).toBeInTheDocument();
  });

  it("選択中の年月の取引だけを読む", async () => {
    renderCard({ month: "2025-03" });

    await screen.findByText("¥ 420,000");

    expect(fetchCashflowData).toHaveBeenCalledWith("2025-03");
  });

  /**
   * 月ごとにキャッシュを分けた目的は読み取りを増やさないこと(同要件B1「年月の選択」)。
   * TanStack Queryの既定(`staleTime: 0`)のままだと、戻ってきた月でも裏で取り直してしまう
   */
  it("一度見た月へ戻ったときは読み直さない", async () => {
    const { rerender } = renderCard({ month: "2026-08" });

    await screen.findByText("¥ 420,000");

    const renderWith = (month: string): void => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <CashflowSummaryCard month={month} maxMonth="2026-08" onMonthChange={onMonthChange} />
        </QueryClientProvider>,
      );
    };

    renderWith("2026-07");
    await waitFor(() => expect(fetchCashflowData).toHaveBeenCalledWith("2026-07"));

    renderWith("2026-08");
    await screen.findByText("¥ 420,000");

    // 2026-08は1回、2026-07は1回。戻った側で2回目が走らない
    expect(fetchCashflowData.mock.calls.map(([month]) => month)).toEqual(["2026-08", "2026-07"]);
  });

  it("年月を選ぶと呼び出し側へ渡す(URLの差し替えは呼び出し側が行う)", async () => {
    const user = userEvent.setup();
    renderCard();

    await screen.findByText("¥ 420,000");
    await user.click(screen.getByRole("button", { name: /対象の年月/ }));
    await user.click(screen.getByRole("button", { name: "3月" }));

    expect(onMonthChange).toHaveBeenCalledWith("2026-03");
  });

  /** 月初や取り込んでいない過去の月では正常に起こる。エラーとしては扱わない */
  it("選択した月に取引が無ければ、その月を添えた空状態とB2への導線を出す", async () => {
    fetchCashflowData.mockResolvedValue({ ok: true, cashflow: null });
    renderCard({ month: "2025-03" });

    expect(
      await screen.findByText(
        "2025年3月の取引がありません。別の月を選ぶか、入出金明細CSVを取り込んでください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSVを取り込む" })).toHaveAttribute(
      "href",
      "/csv-import",
    );
  });

  /**
   * 取得の失敗を空状態として見せない。データはあるのに「ありません」と読める表示になり、
   * 次にすべきことが正反対になる
   */
  it("取得に失敗したら失敗として出し、空状態は出さない", async () => {
    fetchCashflowData.mockResolvedValue({ ok: false, reason: "unknown" });
    renderCard();

    expect(await screen.findByRole("alert")).toHaveTextContent("データを取得できませんでした");
    expect(screen.queryByText(/取引がありません/)).not.toBeInTheDocument();
  });

  /** 年月ごとの取得なので、再試行の導線もこのカードの中に要る */
  it("取得に失敗したときはカードの中で再試行できる", async () => {
    const user = userEvent.setup();
    fetchCashflowData.mockResolvedValueOnce({ ok: false, reason: "unknown" });
    renderCard();

    await user.click(await screen.findByRole("button", { name: "再試行する" }));

    expect(await screen.findByText("¥ 420,000")).toBeInTheDocument();
  });

  /** ログイン切れは再取得しても同じ結果にしかならない(画面全体の失敗表示と同じ判断) */
  it("ログイン切れでは再試行の導線を出さない", async () => {
    fetchCashflowData.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderCard();

    expect(await screen.findByRole("alert")).toHaveTextContent("ログイン状態が切れています");
    expect(screen.queryByRole("button", { name: "再試行する" })).not.toBeInTheDocument();
  });

  /**
   * 全額が振替・計算対象外だった月に普通に起こる。空状態にすると、取り込んである取引を
   * 「無い」と伝えることになる
   */
  it("取引はあるが支出が無い月は、3つの数字を出したままその旨を添える", async () => {
    fetchCashflowData.mockResolvedValue({
      ok: true,
      cashflow: { month: "2026-08", income: 0, expense: 0, expenseByCategory: [] },
    });
    renderCard();

    expect(await screen.findByText("この月の支出はありません。")).toBeInTheDocument();
    // 空状態ではないので、3つの数字は出したまま。円グラフだけを出さない
    expect(screen.getByText("+ ¥ 0")).toBeInTheDocument();
    expect(screen.queryByTestId("expense-breakdown-chart")).not.toBeInTheDocument();
    expect(screen.queryByText(/取引がありません/)).not.toBeInTheDocument();
  });

  it("赤字の月は収支をマイナスの符号付きで出す", async () => {
    fetchCashflowData.mockResolvedValue({
      ok: true,
      cashflow: { month: "2026-08", income: 100_000, expense: 234_300, expenseByCategory: [] },
    });
    renderCard();

    expect(await screen.findByText("- ¥ 134,300")).toBeInTheDocument();
  });

  it("B3への導線を出す", async () => {
    renderCard();

    expect(await screen.findByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/transactions",
    );
  });
});
