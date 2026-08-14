import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

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
vi.mock("@/components/dashboard/CategoryBreakdownChart", () => ({
  CategoryBreakdownChart: () => <div data-testid="category-breakdown-chart" />,
}));

/**
 * 収支サマリは対象の月ごとに自分でFirestoreを引く(docs/screen-requirements-dashboard.md B1
 * 「年月の選択」)。この画面のテストで見たいのは受け取る月と切替の遷移なので、カードは
 * 差し替えて渡された値だけを出す
 */
vi.mock("@/components/dashboard/CashflowSummaryCard", () => ({
  CashflowSummaryCard: ({ month, maxMonth, onMonthChange }: CashflowSummaryCardProps) => (
    <div data-testid="cashflow-summary-card" data-month={month} data-max-month={maxMonth}>
      <button type="button" onClick={() => onMonthChange("2025-03")}>
        2025年3月を選ぶ
      </button>
    </div>
  ),
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
      netWorthSeries: [
        {
          date: "2026-08-05",
          amount: 11_400_000,
          byType: { "株式(現物)": 5_400_000, 投資信託: 1_600_000, "預金・現金": 4_400_000 },
          debtBalance: 0,
          propertyAmount: 0,
        },
      ],
      breakdown: [
        { categoryId: "株式(現物)", amount: 5_400_000 },
        { categoryId: "投資信託", amount: 1_600_000 },
        { categoryId: "預金・現金", amount: 4_400_000 },
      ],
      debtTotal: 0,
      propertyTotal: 0,
      hasSpreadProperty: false,
    },
    investment: {
      netWorthSeries: [
        {
          date: "2026-08-05",
          amount: 7_000_000,
          byType: { "株式(現物)": 5_400_000, 投資信託: 1_600_000 },
          debtBalance: 0,
          propertyAmount: 0,
        },
      ],
      breakdown: [
        { categoryId: "株式(現物)", amount: 5_400_000 },
        { categoryId: "投資信託", amount: 1_600_000 },
      ],
      debtTotal: 0,
      propertyTotal: 0,
      hasSpreadProperty: false,
    },
  },
  debts: [],
  fireProgress: {
    targetAmount: 80_000_000,
    currentAmount: 11_400_000,
    achievementAxisName: "投資性資産",
    achievementAxisMissing: false,
    projection: { status: "projected", achievementDate: "2033-04-01" },
  },
};

/**
 * 収支サマリの既定は当月(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 * 画面が`new Date()`から導く値と突き合わせるため、テスト側も実際の時計から作る
 */
const currentMonth = format(new Date(), "yyyy-MM");

/** 画面の外から再取得を起こすため、画面と同じインスタンスを掴んでおく */
let queryClient: QueryClient;

/**
 * リトライはここでは切らない。画面側が`retry: false`を指定しており、既定のまま包んでも
 * 失敗のテストが指数バックオフで待たされないことを、この形のまま確かめられる
 */
const renderScreen = (props: Partial<DashboardScreenProps> = {}): RenderResult => {
  queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardScreen
        axisParam={undefined}
        periodParam={undefined}
        debtParam={undefined}
        monthParam={undefined}
        {...props}
      />
    </QueryClientProvider>,
  );
};

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
            netWorthSeries: [
              { date: "2000-01-31", amount: 1_000_000, byType: { "預金・現金": 1_000_000 } },
            ],
            breakdown: data.byAxis.total?.breakdown ?? [],
            debtTotal: 0,
            propertyTotal: 0,
            hasSpreadProperty: false,
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
   * ゲージの現在資産額はB8で設定した対象分類で集計しており、この画面のセレクタには
   * 追従しない(要件B1)。どちらの数字か判別できるよう分類名を併記する
   */
  it("FIRE達成度の現在資産額に対象分類名を併記する", async () => {
    renderScreen();

    expect(await screen.findByText("(投資性資産)")).toBeInTheDocument();
  });

  /** 切替ひとつで同じ目標への達成率が別の値になると「どこまで来たか」として読めなくなる */
  it("分類軸を切り替えてもFIRE達成度の現在資産額は変わらない", async () => {
    renderScreen({ axisParam: "investment" });

    expect(await screen.findByText("¥ 11,400,000")).toBeInTheDocument();
    expect(screen.getByText("(投資性資産)")).toBeInTheDocument();
  });

  /** 比較対象が失われただけなので、ゲージを消したり0%にしたりはしない(要件B1) */
  it("対象分類の分類軸が削除されていたら、総資産で計算した旨をカードに出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: {
        ...data,
        fireProgress: {
          ...data.fireProgress,
          achievementAxisName: "総資産(マネーフォワードの合計)",
          achievementAxisMissing: true,
        },
      },
    });
    renderScreen();

    expect(
      await screen.findByText("設定していた対象分類が見つからないため、総資産で計算しています。"),
    ).toBeInTheDocument();
    // 注意書きを出すだけで、ゲージと数字はそのまま残す
    expect(screen.getByText("¥ 11,400,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "目標を設定する" })).toBeInTheDocument();
  });

  /**
   * FIRE達成度は目標資産額との比較で、B1の分類軸セレクタを参照しない(要件B1)。
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

  /**
   * 例外で落ちた再取得では直前の成功データが残る(TanStack Query)。B2の取込やB4の保存で
   * 無効化した直後に起こりうる経路なので、エラーの真下に古い金額が並ばないことを見る。
   * エラーが画面へ伝わるまでに間があるため、待ってから確かめる
   */
  it("再取得が例外で落ちたら、直前の内容を残さずエラーに切り替える", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    renderScreen();

    await screen.findByText("資産推移(総資産)");
    fetchDashboardData.mockRejectedValue(new Error("Invalid time value"));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY }).catch(() => {});
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "データを表示できませんでした。再試行しても直らない場合は、取り込んだCSVのデータに問題がある可能性があります。",
    );
    expect(screen.queryByText("資産推移(総資産)")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  /**
   * rejectでは`data`が更新されないので、`ok: false`の理由が残ったままになる。
   * 理由を先に見ると1つ前の文言を出し続けてしまうため、直近の試行を優先する
   */
  it("取得失敗のあと再試行が例外で落ちたら、例外の文言に切り替える", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    fetchDashboardData.mockResolvedValueOnce({ ok: false, reason: "unknown" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "データを取得できませんでした。時間をおいて再度お試しください。",
    );

    fetchDashboardData.mockRejectedValue(new Error("Invalid time value"));
    await user.click(screen.getByRole("button", { name: "再試行する" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "データを表示できませんでした。再試行しても直らない場合は、取り込んだCSVのデータに問題がある可能性があります。",
      );
    });
    // 例外は一時的なこともあるので、導線は残したまま
    expect(screen.getByRole("button", { name: "再試行する" })).toBeInTheDocument();

    consoleError.mockRestore();
  });

  /** 再取得しても同じ結果にしかならない失敗では、押せる導線を出さない */
  it("ログイン切れ・設定不備のときは再試行の導線を出さない", async () => {
    fetchDashboardData.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログイン状態が切れています。ログインし直してから表示してください。",
    );
    expect(screen.queryByRole("button", { name: "再試行する" })).not.toBeInTheDocument();
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

    expect(replace).toHaveBeenCalledWith(
      `/dashboard?axis=investment&period=1y&debt=with-debt&month=${currentMonth}`,
    );
  });
});

/**
 * 収支サマリの対象月(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 * 対象の月はカードが自分で取得するので、この画面が受け持つのは月の解決と切替の遷移だけ。
 */
describe("DashboardScreen(収支サマリの対象月)", () => {
  beforeEach(() => {
    fetchDashboardData.mockReset();
    replace.mockReset();
    fetchDashboardData.mockResolvedValue({ ok: true, data });
  });

  it("未指定なら当月を渡し、選べる上限も当月にする", async () => {
    renderScreen();

    const card = await screen.findByTestId("cashflow-summary-card");

    expect(card).toHaveAttribute("data-month", currentMonth);
    expect(card).toHaveAttribute("data-max-month", currentMonth);
  });

  it("URLの月をそのまま渡す", async () => {
    renderScreen({ monthParam: "2025-03" });

    expect(await screen.findByTestId("cashflow-summary-card")).toHaveAttribute(
      "data-month",
      "2025-03",
    );
  });

  /** 未来の月には数える取引が無い。ピッカーで押せないのと同じ基準で丸める */
  it("当月より後の月・読めない値は当月に落として渡す", async () => {
    renderScreen({ monthParam: "2099-01" });

    expect(await screen.findByTestId("cashflow-summary-card")).toHaveAttribute(
      "data-month",
      currentMonth,
    );
  });

  it("年月を切り替えると他の選択を保ったままURLのクエリを差し替える", async () => {
    const user = userEvent.setup();
    renderScreen({ axisParam: "investment", periodParam: "3y", debtParam: "assets-only" });

    await user.click(await screen.findByRole("button", { name: "2025年3月を選ぶ" }));

    expect(replace).toHaveBeenCalledWith(
      "/dashboard?axis=investment&period=3y&debt=assets-only&month=2025-03",
    );
  });

  /**
   * 年月切替で読み直すのはその月の取引だけ(同要件B1)。一括取得に混ざったままだと、
   * 月を変えるたびに資産残高・分類軸・負債・FIRE目標まで読み直すことになる
   */
  it("年月が変わってもダッシュボードの一括取得は引き直さない", async () => {
    const { rerender } = renderScreen({ monthParam: "2026-08" });

    await screen.findByTestId("cashflow-summary-card");

    rerender(
      <QueryClientProvider client={queryClient}>
        <DashboardScreen
          axisParam={undefined}
          periodParam={undefined}
          debtParam={undefined}
          monthParam="2025-03"
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("cashflow-summary-card")).toHaveAttribute(
      "data-month",
      "2025-03",
    );
    expect(fetchDashboardData).toHaveBeenCalledTimes(1);
  });
});

/**
 * 負債(B11)の反映(docs/screen-requirements-dashboard.md B1)。
 */
describe("DashboardScreen(負債)", () => {
  const debts: Debt[] = [
    {
      id: "debt-1",
      name: "住宅ローン",
      balance: 18_400_000,
      originatedOn: null,
      interestRate: 0.475,
      repaymentMonths: 280,
      updatedAt: "2026-07-12",
      balanceHistory: { "2026-07-12": 18_400_000 },
    },
    {
      id: "debt-2",
      name: "奨学金",
      balance: 2_300_000,
      originatedOn: null,
      interestRate: null,
      repaymentMonths: null,
      updatedAt: "2026-05-02",
      balanceHistory: { "2026-05-02": 2_300_000 },
    },
  ];

  beforeEach(() => {
    fetchDashboardData.mockReset();
  });

  it("負債サマリを残債の多い順に出し、未登録の金利・返済期間は空欄にする", async () => {
    fetchDashboardData.mockResolvedValue({ ok: true, data: { ...data, debts } });
    renderScreen({ axisParam: "total", periodParam: "all" });

    expect(await screen.findByText("負債サマリ")).toBeInTheDocument();
    expect(screen.getByText("¥ 20,700,000")).toBeInTheDocument();
    expect(screen.getByText("0.475%")).toBeInTheDocument();
    expect(screen.getByText("23年4ヶ月")).toBeInTheDocument();
    expect(screen.getByText("最終更新")).toBeInTheDocument();
  });

  /** 分類軸で絞ると「登録したのに出てこない負債」が生まれる(同要件B1) */
  it("負債サマリは分類軸切替の影響を受けない", async () => {
    fetchDashboardData.mockResolvedValue({ ok: true, data: { ...data, debts } });
    renderScreen({ axisParam: "investment", periodParam: "all" });

    expect(await screen.findByText("住宅ローン")).toBeInTheDocument();
    expect(screen.getByText("奨学金")).toBeInTheDocument();
  });

  it("負債が1件も無ければ空状態とB11への導線を出す", async () => {
    fetchDashboardData.mockResolvedValue({ ok: true, data: { ...data, debts: [] } });
    renderScreen({ axisParam: "total", periodParam: "all" });

    expect(await screen.findByText(/負債がまだ登録されていません/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "負債を登録する" })).toBeInTheDocument();
  });

  /** 円グラフの分母が資産+負債になることが分かるようにする(同要件B1) */
  it("負債を含む分類軸では、内訳のカードに差引後の純額を併記する", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: {
        ...data,
        debts,
        byAxis: {
          ...data.byAxis,
          total: {
            /*
              推移の各点は`sumAxisAmount`を通った値なので、既に負債が引かれている。
              純額はこの最新点をそのまま採る(スライスの足し直しはしない。
              `resolveAxisNetAmount`)ので、資産11,400,000 - 負債2,000,000 = 9,400,000
            */
            netWorthSeries: [
              {
                date: "2026-08-05",
                amount: 9_400_000,
                // 積み上げが描くのは資産種別だけなので、負債を引く前の額を持つ
                byType: { "株式(現物)": 5_400_000, 投資信託: 1_600_000, "預金・現金": 4_400_000 },
              },
            ],
            breakdown: data.byAxis.total?.breakdown ?? [],
            debtTotal: 2_000_000,
          },
        },
      },
    });
    renderScreen({ axisParam: "total", periodParam: "all" });

    expect(await screen.findByText("資産 - 負債")).toBeInTheDocument();
    expect(screen.getByText("¥ 9,400,000")).toBeInTheDocument();
  });

  it("負債を含まない分類軸では純額を併記しない", async () => {
    fetchDashboardData.mockResolvedValue({ ok: true, data: { ...data, debts } });
    renderScreen({ axisParam: "total", periodParam: "all" });

    await screen.findByText("負債サマリ");

    expect(screen.queryByText("資産 - 負債")).not.toBeInTheDocument();
  });

  /** B11-3 ケース1の決定。達成率は0%に丸め、金額はマイナスのまま出す */
  it("現在資産額がマイナスなら、丸めた旨を出しつつ金額は負のまま出す", async () => {
    fetchDashboardData.mockResolvedValue({
      ok: true,
      data: {
        ...data,
        debts,
        fireProgress: { ...data.fireProgress, currentAmount: -1_400_000 } as FireProgress,
      },
    });
    renderScreen({ axisParam: "total", periodParam: "all" });

    expect(await screen.findByText(/負債が資産を上回っているため/u)).toBeInTheDocument();
    expect(screen.getByText("- ¥ 1,400,000")).toBeInTheDocument();
  });
});
