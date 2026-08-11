import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DebtInputScreen } from "@/components/debts/DebtInputScreen";
import { DEBT_MAX_COUNT } from "@/constants/debts";

import type { RenderResult } from "@testing-library/react";

const fetchDebts = vi.fn();
const saveDebts = vi.fn();
const fetchCategoryAxes = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/debts/debt-repository", () => ({
  fetchDebts: (...args: unknown[]) => fetchDebts(...args),
  saveDebts: (...args: unknown[]) => saveDebts(...args),
}));

vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: (...args: unknown[]) => fetchCategoryAxes(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const mortgage: Debt = {
  id: "debt-mortgage",
  name: "住宅ローン(〇〇銀行)",
  balance: 18_400_000,
  originatedOn: null,
  interestRate: 0.475,
  repaymentMonths: 280,
  updatedAt: "2026-07-12",
  balanceHistory: { "2026-07-12": 18_400_000 },
};

const scholarship: Debt = {
  id: "debt-scholarship",
  name: "奨学金(第一種)",
  balance: 2_300_000,
  originatedOn: null,
  interestRate: null,
  repaymentMonths: null,
  updatedAt: "2026-05-02",
  balanceHistory: { "2026-05-02": 2_300_000 },
};

const netAxis: AssetCategoryAxisDocument = {
  id: "axis-net",
  name: "純金融資産",
  assetTypeNames: [],
  debtIds: ["debt-mortgage"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const renderScreen = (): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DebtInputScreen />
    </QueryClientProvider>,
  );

describe("DebtInputScreen", () => {
  beforeEach(() => {
    fetchDebts.mockReset();
    saveDebts.mockReset();
    fetchCategoryAxes.mockReset();
    toastSuccess.mockReset();

    fetchDebts.mockResolvedValue({ ok: true, debts: [mortgage, scholarship] });
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [netAxis] });
    // 保存は保存後の負債を返す。画面が追加した行はここで初めてIDが決まる
    saveDebts.mockResolvedValue({ ok: true, debts: [mortgage, scholarship] });
  });

  it("登録済みの負債を1件=1フォームで並べ、合計と最終更新日を出す", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("住宅ローン(〇〇銀行)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18400000")).toBeInTheDocument();
    expect(screen.getByText("負債合計(2件)")).toBeInTheDocument();
    expect(screen.getByText("¥ 20,700,000")).toBeInTheDocument();
    expect(screen.getByText("最終更新 2026-07-12")).toBeInTheDocument();
  });

  /** 総月数ではなく年・ヶ月の2欄で入力させる(B11「入力項目の補足」) */
  it("残りの返済期間は年・ヶ月の2欄に割り戻して出す", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("23")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  /** 未登録は0%・0ヶ月と区別する */
  it("金利・返済期間が未登録の負債は欄を空にする", async () => {
    fetchDebts.mockResolvedValue({ ok: true, debts: [scholarship] });
    renderScreen();

    await screen.findByDisplayValue("奨学金(第一種)");

    expect(screen.getByLabelText(/金利/u)).toHaveValue("");
    expect(screen.getByLabelText("残りの返済期間(年)")).toHaveValue("");
    expect(screen.getByLabelText("残りの返済期間(ヶ月)")).toHaveValue("");
  });

  it("「負債を追加」で行が増え、保存すると新規として渡す", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledWith(
        [
          {
            id: null,
            name: "カードローン",
            balance: 450_000,
            originatedOn: null,
            interestRate: null,
            repaymentMonths: null,
          },
        ],
        [],
      );
    });
  });

  /** 片方の欄だけの入力はエラーにせず、空欄側を0として総月数へ正規化する(B11-3 ケース2) */
  it("返済期間の片方だけ入力された場合は、空欄側を0として保存する", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.type(screen.getByLabelText("残りの返済期間(年)"), "5");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledWith(
        [expect.objectContaining({ repaymentMonths: 60 })],
        [],
      );
    });
  });

  /**
   * 発生年月(B11-7)。資産推移グラフがこの月から負債を差し引き始めるための入力で、
   * 任意(docs/screen-requirements-dashboard.md B1「発生年月からの反映」)。
   */
  it("発生年月を入力すると、その値を保存に渡す", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.type(screen.getByLabelText(/発生年月/u), "2019-04");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledWith(
        [expect.objectContaining({ originatedOn: "2019-04" })],
        [],
      );
    });
  });

  /** 未来に借りた負債は無い。過去のグラフに反映させないため保存を止める */
  it("当月より後の発生年月はインラインエラーを出し、保存しない", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.type(screen.getByLabelText(/発生年月/u), "2099-12");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("発生年月に未来の年月は入力できません。")).toBeInTheDocument();
    expect(saveDebts).not.toHaveBeenCalled();

    /*
      エラー中はヒント文ではなくエラー文を指す。`role="alert"`は発生した瞬間しか読み上げず、
      あとからこの欄へフォーカスしたときに理由を辿れるのは`aria-describedby`側だけ
    */
    expect(screen.getByLabelText(/発生年月/u)).toHaveAccessibleDescription(
      "発生年月に未来の年月は入力できません。",
    );
  });

  it("項目名・残債の不正はインラインエラーを出し、保存しない", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("残債(円)"), "450,000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("項目名を入力してください。")).toBeInTheDocument();
    expect(screen.getByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(saveDebts).not.toHaveBeenCalled();
  });

  /** 保存前の削除は取り消せるので、削除ボタン自体には確認を挟まない(B11) */
  it("削除ボタンは確認を挟まず行を減らし、合計から外す", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getAllByRole("button", { name: "削除" })[0] as HTMLElement);

    expect(screen.queryByDisplayValue("住宅ローン(〇〇銀行)")).not.toBeInTheDocument();
    expect(screen.getByText("負債合計(1件)")).toBeInTheDocument();
    expect(screen.getByText("¥ 2,300,000")).toBeInTheDocument();
    expect(saveDebts).not.toHaveBeenCalled();
  });

  /** 確認を挟むのは保存時だけ。項目名と残債額を並べ、該当する分類軸をすべて列挙する */
  it("既存の負債を削除して保存すると、確認ダイアログに削除対象と分類軸を出す", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getAllByRole("button", { name: "削除" })[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("負債1件を削除して保存しますか?")).toBeInTheDocument();
    expect(screen.getByText(/住宅ローン\(〇〇銀行\)\(残債 ¥ 18,400,000\)/u)).toBeInTheDocument();
    expect(
      screen.getByText(/資産推移グラフからこの負債の控除が過去に遡って消えます/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/分類軸「純金融資産」の集計も変わります/u)).toBeInTheDocument();
    expect(saveDebts).not.toHaveBeenCalled();
  });

  it("確認ダイアログで実行すると削除を反映した内容で保存する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getAllByRole("button", { name: "削除" })[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "保存" }));
    await user.click(await screen.findByRole("button", { name: "削除して保存する" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledWith(
        [expect.objectContaining({ id: "debt-scholarship", balance: 2_300_000 })],
        // 画面が読み込んだ時点のIDを基準として渡す。削除対象をサーバーの最新状態から
        // 求めると、別のタブで追加された負債まで消える(`saveDebts`)
        ["debt-mortgage", "debt-scholarship"],
      );
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("確認ダイアログをキャンセルすると保存しない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getAllByRole("button", { name: "削除" })[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: "保存" }));
    await user.click(await screen.findByRole("button", { name: "キャンセル" }));

    expect(saveDebts).not.toHaveBeenCalled();
  });

  /** 削除が無い保存では確認を挟まない */
  it("削除を伴わない保存は確認なしで実行する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/削除して保存しますか/u)).not.toBeInTheDocument();
  });

  it("履歴の上限に達していれば、その旨を出して入力値は残す", async () => {
    const user = userEvent.setup();
    saveDebts.mockResolvedValue({ ok: false, reason: "history-limit-exceeded" });
    renderScreen();

    await screen.findByDisplayValue("住宅ローン(〇〇銀行)");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/残債の履歴が上限/u);
    expect(screen.getByDisplayValue("住宅ローン(〇〇銀行)")).toBeInTheDocument();
  });

  /**
   * 取得の失敗を空状態に倒すと、空のフォームで保存して登録済みの負債をすべて消してしまう
   */
  it("負債の取得に失敗したらフォームを出さず失敗を表示する", async () => {
    fetchDebts.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(/参照が許可されていません/u);
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });

  /** 分類軸が無いと、影響のある削除を影響が無いものとして確認させることになる */
  it("分類軸の取得に失敗した場合もフォームを出さない", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
  });

  it("登録件数の上限に達したら「負債を追加」を押せなくする", async () => {
    fetchDebts.mockResolvedValue({
      ok: true,
      debts: Array.from({ length: DEBT_MAX_COUNT }, (_, index) => ({
        ...mortgage,
        id: `debt-${index}`,
        name: `負債${index}`,
      })),
    });
    renderScreen();

    expect(await screen.findByRole("button", { name: /負債を追加/u })).toBeDisabled();
    expect(screen.getByText(`登録できる負債は${DEBT_MAX_COUNT}件までです。`)).toBeInTheDocument();
  });
});

/**
 * 保存後も画面に留まる(B11の遷移条件)ため、同じフォームから続けて保存できる。
 * 保存でIDが決まった行をフォーム側に反映しないと、次の保存でその負債が
 * 「消して作り直し」に化け、残債の履歴が失われる(PR #83 のレビュー指摘)。
 */
describe("DebtInputScreen(保存してから続けて保存する)", () => {
  const created: Debt = {
    id: "debt-created",
    name: "カードローン",
    balance: 450_000,
    originatedOn: null,
    interestRate: null,
    repaymentMonths: null,
    updatedAt: "2026-08-08",
    balanceHistory: { "2026-08-08": 450_000 },
  };

  beforeEach(() => {
    fetchDebts.mockReset();
    saveDebts.mockReset();
    fetchCategoryAxes.mockReset();
    toastSuccess.mockReset();

    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    saveDebts.mockResolvedValue({ ok: true, debts: [created] });
  });

  it("追加した負債は2回目の保存で採番済みのIDとして渡る", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    // 1回目は未採番なのでid: null
    await waitFor(() => {
      expect(saveDebts).toHaveBeenNthCalledWith(1, [expect.objectContaining({ id: null })], []);
    });

    await user.click(screen.getByRole("button", { name: "保存" }));

    // 2回目は保存が返したIDが載る。載らないと新規作成として書き直され履歴が消える
    await waitFor(() => {
      expect(saveDebts).toHaveBeenNthCalledWith(
        2,
        [expect.objectContaining({ id: "debt-created" })],
        expect.any(Array),
      );
    });
  });

  it("2回目の保存で、触っていない負債が削除確認ダイアログに出ない", async () => {
    const user = userEvent.setup();
    /*
      保存成功後の`invalidateQueries`による再取得を模す。2回目以降は採番済みの負債が
      返るので、フォーム側のIDが同期されていないと`buildDebtDeletionPreviews`が
      それを削除対象と誤判定してダイアログを出す
    */
    fetchDebts.mockResolvedValueOnce({ ok: true, debts: [] });
    fetchDebts.mockResolvedValue({ ok: true, debts: [created] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: /負債を追加/u }));
    await user.type(screen.getByLabelText("項目名"), "カードローン");
    await user.type(screen.getByLabelText("残債(円)"), "450000");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(saveDebts).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(/削除して保存しますか/u)).not.toBeInTheDocument();
  });
});
