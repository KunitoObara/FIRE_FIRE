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

const onAchievementAxisChange = vi.fn();

/** B4に登録済みの分類軸(対象分類の選択肢) */
const achievementAxisOptions: AchievementAxisOption[] = [
  {
    id: "axis-investment",
    name: "投資性資産",
    assetTypeNames: ["株式(現物)"],
    debtIds: [],
    propertyValuations: {},
  },
];

const renderForm = (overrides: Partial<FireGoalFormProps> = {}): RenderResult =>
  render(
    <FireGoalForm
      initialValues={initialValues}
      currentAssetTotal={49_600_000}
      achievementAxisName="総資産(マネーフォワードの合計)"
      achievementAxisOptions={achievementAxisOptions}
      achievementAxisId={null}
      onAchievementAxisChange={onAchievementAxisChange}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

const targetAmountInput = (): HTMLElement => screen.getByLabelText("目標資産額(円)");
const annualExpenseInput = (): HTMLElement => screen.getByLabelText("想定年間支出額(円)");
const withdrawalRateInput = (): HTMLElement => screen.getByLabelText("逆算係数(%)");
const modeTab = (name: string): HTMLElement => screen.getByRole("tab", { name });

/**
 * 直接入力タブを表示したまま、非表示の逆算タブにだけ形式の誤りを残した状態を作る。
 *
 * この状態で保存すると、逆算タブのエラーで保存が止まり、フォームが逆算タブへ切り替える。
 */
const typoInHiddenReverseTab = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(modeTab("年間支出額から逆算"));
  await user.type(annualExpenseInput(), "3,600,000");
  await user.click(modeTab("直接入力"));
  await user.type(targetAmountInput(), "80000000");
};

/** 切り替えの説明。文言そのものが対応内容なので、定数を参照せず期待値を直接書く */
const hiddenTabNoticeText =
  "「直接入力」で保存しようとしましたが、表示していなかった「年間支出額から逆算」の入力に誤りがあるため保存できません。誤りを直すか、「年間支出額から逆算」の入力を消してから「直接入力」に戻って保存してください。";

describe("FireGoalForm", () => {
  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue({ ok: true });
    onAchievementAxisChange.mockReset();
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
        achievementAxisId: null,
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
        achievementAxisId: null,
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
        achievementAxisId: null,
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

    await typoInHiddenReverseTab(user);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(modeTab("年間支出額から逆算")).toHaveAttribute("aria-selected", "true");
    });
    expect(screen.getByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** 切り替わったこと自体は見えるが、なぜ飛ばされたのかが読み取れなかったため添える説明 */
  it("非表示タブのエラーで切り替えたときは、切り替えた理由を説明する", async () => {
    const user = userEvent.setup();
    renderForm();

    await typoInHiddenReverseTab(user);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("status")).toHaveTextContent(hiddenTabNoticeText);
  });

  it("表示中のタブのエラーで止まったときは、タブ切替の説明を出さない", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(targetAmountInput(), "80,000,000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /** 自分でタブを選び直したあとも残ると、見ているタブと合わない案内になる */
  it("自分でタブを選び直すと、切り替えの説明は消える", async () => {
    const user = userEvent.setup();
    renderForm();

    await typoInHiddenReverseTab(user);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(modeTab("直接入力"));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /** 説明文が案内する操作順(誤りのある欄を消す → 元のタブに戻る → 保存)が実際に通ること */
  it("切り替え先の入力を消して元のタブに戻れば、元の方式のまま保存できる", async () => {
    const user = userEvent.setup();
    renderForm();

    await typoInHiddenReverseTab(user);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.clear(annualExpenseInput());
    await user.click(modeTab("直接入力"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "direct",
        targetAmount: 80_000_000,
        annualExpense: null,
        withdrawalRate: 4,
        achievementAxisId: null,
      });
    });
  });

  it("誤りを直して保存できたときは、切り替えの説明は消える", async () => {
    const user = userEvent.setup();
    renderForm();

    await typoInHiddenReverseTab(user);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();

    // 切り替えられた先(逆算タブ)で誤りを直すと、その方式が有効な設定方式として保存される
    await user.clear(annualExpenseInput());
    await user.type(annualExpenseInput(), "3600000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "reverse",
        targetAmount: 80_000_000,
        annualExpense: 3_600_000,
        withdrawalRate: 4,
        achievementAxisId: null,
      });
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

    expect(
      await screen.findByText("現在資産額(総資産(マネーフォワードの合計))に対する達成率: 62%"),
    ).toBeInTheDocument();
  });

  /**
   * 選択肢からの選択なので通常は起こらないが、画面を開いたまま別のタブでB4から分類軸を
   * 削除すると起こりうる。黙って既定へ倒すと、設定したつもりの分類とは別の基準で
   * 達成率を見続けることになる(要件B8「存在しない分類軸IDが渡された場合は保存を拒否する」)
   */
  it("選択中の対象分類が選択肢に無ければ保存せずエラーを出す", async () => {
    const user = userEvent.setup();
    renderForm({ achievementAxisId: "axis-deleted" });

    await user.type(targetAmountInput(), "80000000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText(
        "選択した対象分類が見つかりません。分類を選び直してから保存してください。",
      ),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("対象分類を選び直すと、選択を呼び出し側へ伝える", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("達成度の対象分類"));
    await user.click(screen.getByRole("option", { name: "投資性資産" }));

    expect(onAchievementAxisChange).toHaveBeenCalledWith("axis-investment");
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
