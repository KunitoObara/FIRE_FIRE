import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FireGoalScreen } from "@/components/fire-goal/FireGoalScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

import type { RenderResult } from "@testing-library/react";

const fetchFireGoal = vi.fn();
const saveFireGoal = vi.fn();
const fetchLatestAssetSnapshot = vi.fn();
const fetchCategoryAxes = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/fire-goal/fire-goal-repository", () => ({
  fetchFireGoal: () => fetchFireGoal(),
  saveFireGoal: (...args: unknown[]) => saveFireGoal(...args),
}));

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchLatestAssetSnapshot: () => fetchLatestAssetSnapshot(),
}));

vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: () => fetchCategoryAxes(),
}));

/**
 * 直近の資産残高。合計(49,600,000)は資産種別の足し合わせ(49,000,000)と一致させていない。
 * 対象分類の切替で参考表示が実際に集計し直されていることを、値の違いで確かめられるようにする。
 */
const latestSnapshot: AssetSnapshot = {
  date: "2026-08-01",
  total: 49_600_000,
  byType: { "預金・現金": 19_000_000, "株式(現物)": 30_000_000 },
};

/** B4に登録済みの分類軸(対象分類の選択肢) */
const investmentAxis = {
  id: "axis-investment",
  name: "投資性資産",
  assetTypeNames: ["株式(現物)"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

/** 保存後にどのキーを無効化したかを確かめるため、画面と同じインスタンスを掴んでおく */
let queryClient: QueryClient;

const renderScreen = (): RenderResult => {
  queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <FireGoalScreen />
    </QueryClientProvider>,
  );
};

describe("FireGoalScreen", () => {
  beforeEach(() => {
    fetchFireGoal.mockReset();
    saveFireGoal.mockReset();
    fetchLatestAssetSnapshot.mockReset();
    fetchCategoryAxes.mockReset();
    push.mockReset();
    toastSuccess.mockReset();

    fetchFireGoal.mockResolvedValue({ ok: true, goal: null });
    saveFireGoal.mockResolvedValue({ ok: true });
    fetchLatestAssetSnapshot.mockResolvedValue({ ok: true, snapshot: latestSnapshot });
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [investmentAxis] });
  });

  it("保存済みの目標を両タブの初期値に入れる", async () => {
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "reverse",
        targetAmount: 80_000_000,
        annualExpense: 3_600_000,
        withdrawalRate: 4,
        achievementAxisId: null,
      },
    });
    renderScreen();

    expect(await screen.findByLabelText("想定年間支出額(円)")).toHaveValue("3600000");
    expect(screen.getByLabelText("目標資産額(円)")).toHaveValue("80000000");
    expect(screen.getByRole("tab", { name: "年間支出額から逆算" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("現在有効な設定方式と現在資産額を参考表示する", async () => {
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
        achievementAxisId: null,
      },
    });
    renderScreen();

    expect(await screen.findByText("直接入力", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("¥ 49,600,000")).toBeInTheDocument();
  });

  it("まだ保存していなければ設定方式は未設定と表示する", async () => {
    renderScreen();

    expect(await screen.findByText("未設定")).toBeInTheDocument();
  });

  it("保存に成功するとB1へ遷移して完了を通知する", async () => {
    const user = userEvent.setup();
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.type(await screen.findByLabelText("目標資産額(円)"), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveFireGoal).toHaveBeenCalledWith({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: 4,
        achievementAxisId: null,
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("FIRE目標を保存しました");
    expect(push).toHaveBeenCalledWith("/dashboard");
    // 遷移先のB1が古い目標でゲージを描かないよう、表示データも無効化する
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
  });

  it("保存に失敗したら遷移しない", async () => {
    const user = userEvent.setup();
    saveFireGoal.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    await user.type(await screen.findByLabelText("目標資産額(円)"), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  /** 現在資産額は参考表示であって、目標の設定を妨げるものではない */
  it("現在資産額を取得できなくても目標は設定できる", async () => {
    const user = userEvent.setup();
    fetchLatestAssetSnapshot.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    expect(await screen.findByText("—")).toBeInTheDocument();

    await user.type(screen.getByLabelText("目標資産額(円)"), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/dashboard");
    });
  });

  /**
   * 要件B8「参考表示の現在資産額・達成率にも対象分類名を併記する」。
   * 保存を待たずに切り替わることで、「この分類にすると達成率がこうなる」を先に確かめられる。
   */
  it("対象分類を選ぶと、保存前でも参考表示の現在資産額と分類名がその分類で計算し直される", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText("¥ 49,600,000")).toBeInTheDocument();

    await user.click(screen.getByLabelText("達成度の対象分類"));
    await user.click(screen.getByRole("option", { name: "投資性資産" }));

    // 「株式(現物)」だけを集計対象にした分類軸なので、合計ではなくその額になる
    expect(await screen.findByText("¥ 30,000,000")).toBeInTheDocument();
    expect(screen.getAllByText("(投資性資産)").length).toBeGreaterThan(0);
  });

  it("選んだ対象分類を目標と同じドキュメントに保存する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText("目標資産額(円)"), "80000000");
    await user.click(screen.getByLabelText("達成度の対象分類"));
    await user.click(screen.getByRole("option", { name: "投資性資産" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveFireGoal).toHaveBeenCalledWith(
        expect.objectContaining({ achievementAxisId: "axis-investment" }),
      );
    });
  });

  /**
   * 存在しない選択肢を選択中として出すことはできず、黙って戻すと設定し直したことに
   * 気付けない(要件B8)。B4側の削除は禁止しない前提の扱い。
   */
  it("保存済みの対象分類がB4で削除されていたら、既定に戻したうえでその旨を表示する", async () => {
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: null,
        achievementAxisId: "axis-deleted",
      },
    });
    renderScreen();

    expect(
      await screen.findByText(
        "設定していた対象分類が見つからないため、「総資産(マネーフォワードの合計)」に戻しました。必要であれば選び直して保存してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("達成度の対象分類")).toHaveTextContent(
      "総資産(マネーフォワードの合計)",
    );
    // 既定に戻したので、集計もCSVの合計列に戻る
    expect(screen.getByText("¥ 49,600,000")).toBeInTheDocument();
  });

  /** 分類軸が無いこと自体はエラーではなく、保存もできる(要件B8) */
  it("分類軸が1件も無ければ既定だけを選べる状態にし、B4への導線を添える", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    renderScreen();

    expect(await screen.findByRole("link", { name: "資産分類マスタを開く" })).toHaveAttribute(
      "href",
      "/asset-categories",
    );
    expect(screen.getByLabelText("達成度の対象分類")).toHaveTextContent(
      "総資産(マネーフォワードの合計)",
    );
  });

  it("目標を取得できなければ理由を表示してフォームを出さない", async () => {
    fetchFireGoal.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログイン状態が切れています。ログインし直してから操作してください。",
    );
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });
});
