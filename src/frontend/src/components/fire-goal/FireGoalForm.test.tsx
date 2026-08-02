import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FireGoalForm } from "@/components/fire-goal/FireGoalForm";

import type { RenderResult } from "@testing-library/react";

const onSubmit = vi.fn();

/** 未設定のアカウントがB8を開いた直後の状態(逆算係数だけ既定値が入る) */
const initialValues: FireGoalFormValues = {
  mode: "direct",
  targetAmount: "",
  annualExpense: "",
  withdrawalRate: "4",
};

const renderForm = (overrides: Partial<FireGoalFormProps> = {}): RenderResult =>
  render(
    <FireGoalForm
      initialValues={initialValues}
      currentAssetTotal={49_600_000}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

const targetAmountInput = (): HTMLElement => screen.getByLabelText("目標資産額(円)");
const annualExpenseInput = (): HTMLElement => screen.getByLabelText("想定年間支出額(円)");
const withdrawalRateInput = (): HTMLElement => screen.getByLabelText("逆算係数(%)");
const modeTab = (name: string): HTMLElement => screen.getByRole("tab", { name });

describe("FireGoalForm", () => {
  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue({ ok: true });
  });

  /** 要件「タブ切替時、入力値は両タブとも保持される」そのもの */
  it("タブを行き来しても両タブの入力値が消えない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80000000");
    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3600000");
    await user.click(modeTab("直接入力"));

    expect(targetAmountInput()).toHaveValue("80000000");
    expect(annualExpenseInput()).toHaveValue("3600000");
  });

  it("有効な方式だけでなく、非表示タブの入力値も保存する", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80000000");
    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3600000");
    await user.click(modeTab("直接入力"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: 3_600_000,
        withdrawalRate: 4,
      });
    });
  });

  it("選択中のタブが有効な設定方式として保存される", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3600000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "reverse",
        targetAmount: null,
        annualExpense: 3_600_000,
        withdrawalRate: 4,
      });
    });
  });

  it("有効な方式の欄が未入力ならインラインエラーを出して保存しない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("目標資産額(円)を入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** 直接入力しか使わないユーザーに、使う予定のない年間支出額の入力まで求めない */
  it("使っていない方式の欄が未入力でも保存できる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: 4,
      });
    });
  });

  it("カンマ区切りの金額はインラインエラーになる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80,000,000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** 見えない場所でエラーになっていて、押しても何も起きないボタンにしないため */
  it("非表示タブの入力に誤りがあるときは、そのタブへ切り替えてエラーを見せる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3,600,000");
    await user.click(modeTab("直接入力"));
    await user.type(targetAmountInput(), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(modeTab("年間支出額から逆算")).toHaveAttribute("aria-selected", "true");
    });
    expect(screen.getByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("逆算タブでは入力しながら目標資産額を算出して見せる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3600000");

    expect(await screen.findByText("¥ 90,000,000")).toBeInTheDocument();
  });

  it("逆算係数を変えると算出結果も変わる", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(modeTab("年間支出額から逆算"));
    await user.type(annualExpenseInput(), "3600000");
    await user.clear(withdrawalRateInput());
    await user.type(withdrawalRateInput(), "5");

    expect(await screen.findByText("¥ 72,000,000")).toBeInTheDocument();
  });

  it("現在資産額が分かっていれば達成率を参考表示する", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80000000");

    expect(await screen.findByText("現在資産額に対する達成率: 62%")).toBeInTheDocument();
  });

  /** CSV未取込のアカウントでは比較対象が無いので、達成率は出さずに目標だけ設定させる */
  it("現在資産額が分からなければ達成率は出さない", async () => {
    const user = userEvent.setup();
    renderForm({ currentAssetTotal: null });

    await user.type(targetAmountInput(), "80000000");

    expect(screen.queryByText(/達成率/u)).not.toBeInTheDocument();
  });

  it("保存に失敗したら理由を表示する", async () => {
    const user = userEvent.setup();
    onSubmit.mockResolvedValue({ ok: false, reason: "unknown" });
    renderForm();

    await user.type(targetAmountInput(), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "操作に失敗しました。時間をおいて再度お試しください。",
    );
  });
});
