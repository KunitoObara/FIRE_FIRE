import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssumptionSettingsScreen } from "@/components/assumptions/AssumptionSettingsScreen";

import type { RenderResult } from "@testing-library/react";

const fetchAssumptions = vi.fn();
const saveAssumptions = vi.fn();
const fetchLatestAssetBalances = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/assumptions/assumption-repository", () => ({
  fetchAssumptions: () => fetchAssumptions(),
  saveAssumptions: (...args: unknown[]) => saveAssumptions(...args),
}));

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchLatestAssetBalances: () => fetchLatestAssetBalances(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AssumptionSettingsScreen />
    </QueryClientProvider>,
  );

describe("AssumptionSettingsScreen", () => {
  beforeEach(() => {
    fetchAssumptions.mockReset();
    saveAssumptions.mockReset();
    fetchLatestAssetBalances.mockReset();
    push.mockReset();
    toastSuccess.mockReset();

    fetchAssumptions.mockResolvedValue({ ok: true, assumptions: {} });
    saveAssumptions.mockResolvedValue({ ok: true });
    fetchLatestAssetBalances.mockResolvedValue({
      ok: true,
      balances: [
        { assetTypeName: "株式(現物)", balance: 18_320_500 },
        { assetTypeName: "預金・現金", balance: 2_140_000 },
      ],
    });
  });

  it("資産種別ごとの名称と現在残高を一覧に出す", async () => {
    renderScreen();

    expect(await screen.findByText("株式(現物)")).toBeInTheDocument();
    expect(screen.getByText("¥ 18,320,500")).toBeInTheDocument();
    expect(screen.getByText("預金・現金")).toBeInTheDocument();
    expect(screen.getByText("¥ 2,140,000")).toBeInTheDocument();
  });

  it("保存済みの想定利回り・リスクを一覧の初期値に入れる", async () => {
    fetchAssumptions.mockResolvedValue({
      ok: true,
      assumptions: { "株式(現物)": { expectedReturn: 6, riskLevel: "high" } },
    });
    renderScreen();

    expect(await screen.findByLabelText("株式(現物)の想定利回り(年率%)")).toHaveValue("6");
    expect(screen.getByLabelText("株式(現物)のリスクレベル")).toHaveTextContent("高");
    expect(screen.getByLabelText("預金・現金のリスクレベル")).toHaveTextContent("未設定");
  });

  it("保存に成功するとB1へ遷移して完了を通知する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText("株式(現物)の想定利回り(年率%)"), "6");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveAssumptions).toHaveBeenCalledWith({
        "株式(現物)": { expectedReturn: 6, riskLevel: null },
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("想定利回り・リスクを保存しました");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("リスクレベルを選んで保存できる", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByLabelText("預金・現金のリスクレベル"));
    await user.click(screen.getByRole("option", { name: "低" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveAssumptions).toHaveBeenCalledWith({
        "預金・現金": { expectedReturn: null, riskLevel: "low" },
      });
    });
  });

  /** 要件の遷移条件「バリデーションエラー → インラインエラー表示、遷移しない」 */
  it("数値でない想定利回りはインラインエラーにして保存しない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText("株式(現物)の想定利回り(年率%)"), "5%");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(saveAssumptions).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("範囲外の想定利回りは保存しない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(await screen.findByLabelText("株式(現物)の想定利回り(年率%)"), "500");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("想定利回りは-100%〜100%の範囲で入力してください。"),
    ).toBeInTheDocument();
    expect(saveAssumptions).not.toHaveBeenCalled();
  });

  it("保存に失敗したら遷移しない", async () => {
    const user = userEvent.setup();
    saveAssumptions.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    await user.type(await screen.findByLabelText("株式(現物)の想定利回り(年率%)"), "6");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  /** 一覧の行は取り込んだ資産残高から作るため、未取込だと設定する対象が無い */
  it("資産残高が未取込ならB2への導線を出してフォームを出さない", async () => {
    fetchLatestAssetBalances.mockResolvedValue({ ok: true, balances: [] });
    renderScreen();

    expect(await screen.findByRole("link", { name: "CSVを取り込む" })).toHaveAttribute(
      "href",
      "/csv-import",
    );
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });

  it("残高を取得できなければ理由を表示してフォームを出さない", async () => {
    fetchLatestAssetBalances.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ログイン状態が切れています。ログインし直してから操作してください。",
    );
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });

  /** 保存済みの設定が読めない状態で保存すると、その設定を消してしまう */
  it("保存済みの設定を取得できなければ理由を表示してフォームを出さない", async () => {
    fetchAssumptions.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "操作に失敗しました。時間をおいて再度お試しください。",
    );
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });
});
