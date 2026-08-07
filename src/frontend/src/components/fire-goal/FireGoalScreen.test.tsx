import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FireGoalScreen } from "@/components/fire-goal/FireGoalScreen";

import type { RenderResult } from "@testing-library/react";

const fetchFireGoal = vi.fn();
const saveFireGoal = vi.fn();
const fetchLatestAssetTotal = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/fire-goal/fire-goal-repository", () => ({
  fetchFireGoal: () => fetchFireGoal(),
  saveFireGoal: (...args: unknown[]) => saveFireGoal(...args),
}));

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchLatestAssetTotal: () => fetchLatestAssetTotal(),
}));

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
    fetchLatestAssetTotal.mockReset();
    push.mockReset();
    toastSuccess.mockReset();

    fetchFireGoal.mockResolvedValue({ ok: true, goal: null });
    saveFireGoal.mockResolvedValue({ ok: true });
    fetchLatestAssetTotal.mockResolvedValue({ ok: true, total: 49_600_000 });
  });

  it("保存済みの目標を両タブの初期値に入れる", async () => {
    fetchFireGoal.mockResolvedValue({
      ok: true,
      goal: {
        mode: "reverse",
        targetAmount: 80_000_000,
        annualExpense: 3_600_000,
        withdrawalRate: 4,
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
      goal: { mode: "direct", targetAmount: 80_000_000, annualExpense: null, withdrawalRate: null },
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
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("FIRE目標を保存しました");
    expect(push).toHaveBeenCalledWith("/dashboard");
    // 遷移先のB1が古い目標でゲージを描かないよう、表示データも無効化する
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard-data"] });
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
    fetchLatestAssetTotal.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    expect(await screen.findByText("—")).toBeInTheDocument();

    await user.type(screen.getByLabelText("目標資産額(円)"), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/dashboard");
    });
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
