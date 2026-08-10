import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetCategoryMasterScreen } from "@/components/asset-categories/AssetCategoryMasterScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

import type { RenderResult } from "@testing-library/react";

const fetchCategoryAxes = vi.fn();
const fetchDebts = vi.fn();
const fetchAssetTypeOptions = vi.fn();
const createCategoryAxis = vi.fn();
const updateCategoryAxis = vi.fn();
const deleteCategoryAxis = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/asset-categories/category-axis-repository", () => ({
  fetchCategoryAxes: (...args: unknown[]) => fetchCategoryAxes(...args),
  fetchAssetTypeOptions: (...args: unknown[]) => fetchAssetTypeOptions(...args),
  createCategoryAxis: (...args: unknown[]) => createCategoryAxis(...args),
  updateCategoryAxis: (...args: unknown[]) => updateCategoryAxis(...args),
  deleteCategoryAxis: (...args: unknown[]) => deleteCategoryAxis(...args),
}));

vi.mock("@/lib/debts/debt-repository", () => ({
  fetchDebts: (...args: unknown[]) => fetchDebts(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const TOTAL_ASSETS_AXIS: AssetCategoryAxisDocument = {
  id: "total-assets",
  name: "総資産",
  assetTypeNames: [],
  debtIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NET_FINANCIAL_AXIS: AssetCategoryAxisDocument = {
  id: "net-financial",
  name: "純金融資産",
  assetTypeNames: ["預金・現金", "投資信託"],
  debtIds: [],
  createdAt: "2026-01-02T00:00:00.000Z",
};

/** 保存後にどのキーを無効化したかを確かめるため、画面と同じインスタンスを掴んでおく */
let queryClient: QueryClient;

/** `useQuery`を使うため、テストでも`QueryClientProvider`で包む必要がある */
const renderScreen = (): RenderResult => {
  queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AssetCategoryMasterScreen />
    </QueryClientProvider>,
  );
};

describe("AssetCategoryMasterScreen", () => {
  beforeEach(() => {
    fetchCategoryAxes.mockReset();
    // 負債の選択肢(B4「集計対象に負債を含める」)。既定は取得成功・0件にして、
    // 負債を扱わない既存のケースが読み込み中で止まらないようにする
    fetchDebts.mockReset();
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    fetchAssetTypeOptions.mockReset();
    createCategoryAxis.mockReset();
    updateCategoryAxis.mockReset();
    deleteCategoryAxis.mockReset();
    toastSuccess.mockReset();

    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [TOTAL_ASSETS_AXIS, NET_FINANCIAL_AXIS],
    });
    fetchAssetTypeOptions.mockResolvedValue({
      ok: true,
      assetTypeNames: ["預金・現金", "投資信託", "株式(現物)"],
    });
  });

  it("登録済みの分類軸を一覧表示する", async () => {
    renderScreen();

    expect(await screen.findByText("総資産")).toBeInTheDocument();
    expect(screen.getByText("すべての資産種別が対象")).toBeInTheDocument();
    expect(screen.getByText("純金融資産")).toBeInTheDocument();
    expect(screen.getByText("預金・現金、投資信託")).toBeInTheDocument();
  });

  it("分類軸が1つも無い場合は登録を促す案内を出す", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [] });
    renderScreen();

    expect(await screen.findByText(/分類軸がまだ登録されていません/u)).toBeInTheDocument();
  });

  /** 取得の失敗を「0件」として見せない。登録済みでも未登録に見えてしまうため */
  it("分類軸の取得に失敗したら、登録を促す案内ではなく失敗を出す", async () => {
    fetchCategoryAxes.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "このデータの参照が許可されていません。ログインし直してください。",
    );
    expect(screen.queryByText(/分類軸がまだ登録されていません/u)).not.toBeInTheDocument();
  });

  /**
   * 選択肢の取得に失敗した状態と、CSVを一度も取り込んでいない状態を画面で区別する。
   * 区別が付かないと「取り込んだはずなのに未取込と言われる」ように見える(B4-1)
   */
  it("集計対象の取得に失敗したら、CSV未取込の案内ではなく失敗を出して保存させない", async () => {
    const user = userEvent.setup();
    fetchAssetTypeOptions.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "データを取得できませんでした。時間をおいて再度お試しください。",
    );
    expect(screen.queryByText(/CSVを取り込むと選択できるようになります/u)).not.toBeInTheDocument();
    // 集計対象を選べないまま「すべての資産種別が対象」の軸を作らせない
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  /**
   * 選択肢は `assetSnapshots` を走査するぶん一覧より遅く終わり得る。読み込み中に保存できると、
   * 集計対象を選べないまま「すべての資産種別が対象」の軸ができる(B4-2)
   */
  it("集計対象を読み込んでいるあいだは、CSV未取込の案内を出さず保存もさせない", async () => {
    const user = userEvent.setup();
    // 解決しないPromiseで読み込み中のまま止める
    fetchAssetTypeOptions.mockReturnValue(new Promise(() => {}));
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "集計対象の選択肢を読み込んでいます...",
    );
    expect(screen.queryByText(/CSVを取り込むと選択できるようになります/u)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  /**
   * 編集も同じ抑止が要る。チェックボックスが出る前に保存すると、既存の割り当てが
   * 空のまま上書きされて消える
   */
  it("集計対象を読み込んでいるあいだは、編集フォームからも保存させない", async () => {
    const user = userEvent.setup();
    fetchAssetTypeOptions.mockReturnValue(new Promise(() => {}));
    renderScreen();

    const row = (await screen.findByText("純金融資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "編集" }));

    expect(screen.getByLabelText("分類名")).toHaveValue("純金融資産");
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("新規分類を追加して保存すると、一覧を取り直して完了を通知する", async () => {
    const user = userEvent.setup();
    createCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "生活防衛資金");
    await user.click(screen.getByLabelText("預金・現金"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith({
        name: "生活防衛資金",
        assetTypeNames: ["預金・現金"],
        debtIds: [],
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("分類を追加しました");
    // 保存後はフォームを閉じる
    expect(screen.queryByLabelText("分類名")).not.toBeInTheDocument();
    // 一覧だけでなく集計対象の選択肢も取り直す(レビュー指摘: コメントと実装の食い違い)
    await waitFor(() => {
      expect(fetchAssetTypeOptions).toHaveBeenCalledTimes(2);
    });
    // 分類軸はB1の軸セレクタと集計を決めるので、B1の表示データも無効化する
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
  });

  it("分類名が空のまま保存しようとするとエラーを出し、保存処理を呼ばない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("分類名を入力してください。");
    expect(createCategoryAxis).not.toHaveBeenCalled();
  });

  it("分類名が上限文字数を超えるとエラーを出し、保存処理を呼ばない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByText("総資産");
    await user.click(screen.getByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "あ".repeat(41));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "分類名は40文字以内で入力してください。",
    );
    expect(createCategoryAxis).not.toHaveBeenCalled();
  });

  it("編集フォームには既存の値が入っており、保存すると更新する", async () => {
    const user = userEvent.setup();
    updateCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const row = (await screen.findByText("純金融資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "編集" }));

    const nameInput = screen.getByLabelText("分類名");
    expect(nameInput).toHaveValue("純金融資産");
    expect(screen.getByLabelText("預金・現金")).toBeChecked();
    expect(screen.getByLabelText("株式(現物)")).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateCategoryAxis).toHaveBeenCalledWith("net-financial", {
        name: "純金融資産",
        assetTypeNames: ["預金・現金", "投資信託"],
        debtIds: [],
      });
    });
    // 新規追加と同じくB1の表示データも無効化する(片方の分岐だけ外れても気づけるように)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
  });

  /**
   * 編集フォームを保存せずに別の分類軸へ切り替えた場合、フォームの入力状態が前の分類軸の
   * ままにならないことを確かめる。`key`が無いとReactがフォームのstateを使い回し、
   * 別の分類軸へ前の入力内容で上書き保存してしまう(レビュー指摘)。
   */
  it("保存せずに編集対象を切り替えると、フォームが切り替え先の値にリセットされる", async () => {
    const user = userEvent.setup();
    updateCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    const netFinancialRow = (await screen.findByText("純金融資産")).closest("li");
    const totalAssetsRow = screen.getByText("総資産").closest("li");

    if (netFinancialRow === null || totalAssetsRow === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(netFinancialRow).getByRole("button", { name: "編集" }));
    await user.clear(screen.getByLabelText("分類名"));
    await user.type(screen.getByLabelText("分類名"), "書きかけの名前");

    await user.click(within(totalAssetsRow).getByRole("button", { name: "編集" }));

    expect(screen.getByLabelText("分類名")).toHaveValue("総資産");

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateCategoryAxis).toHaveBeenCalledWith("total-assets", {
        name: "総資産",
        assetTypeNames: [],
        debtIds: [],
      });
    });
  });

  it("集計対象が割り当てられた分類の削除はブロックし、理由を表示する", async () => {
    const user = userEvent.setup();
    renderScreen();

    const row = (await screen.findByText("純金融資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.getByText(/先に編集で割り当てを解除してください/u)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
    expect(deleteCategoryAxis).not.toHaveBeenCalled();
  });

  it("集計対象が無い分類は確認のうえ削除でき、一覧を取り直して完了を通知する", async () => {
    const user = userEvent.setup();
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const row = (await screen.findByText("総資産")).closest("li");

    if (row === null) {
      throw new Error("行が見つからない");
    }

    await user.click(within(row).getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
    expect(toastSuccess).toHaveBeenCalledWith("分類を削除しました");
    // 削除した軸がB1の軸セレクタに残らないよう、新規追加・編集と同じくB1も無効化する
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
  });
});

/**
 * 集計対象に負債を含める(docs/screen-requirements-dashboard.md B4)。
 */
describe("AssetCategoryMasterScreen(負債)", () => {
  const mortgage: Debt = {
    id: "debt-mortgage",
    name: "住宅ローン",
    balance: 18_400_000,
    interestRate: null,
    repaymentMonths: null,
    updatedAt: "2026-07-12",
    balanceHistory: {},
  };

  beforeEach(() => {
    fetchCategoryAxes.mockReset();
    fetchAssetTypeOptions.mockReset();
    createCategoryAxis.mockReset();
    updateCategoryAxis.mockReset();
    fetchDebts.mockReset();
    deleteCategoryAxis.mockReset();
    toastSuccess.mockReset();

    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [TOTAL_ASSETS_AXIS] });
    fetchAssetTypeOptions.mockResolvedValue({ ok: true, assetTypeNames: ["預金・現金"] });
    fetchDebts.mockResolvedValue({ ok: true, debts: [mortgage] });
    createCategoryAxis.mockResolvedValue({ ok: true });
    updateCategoryAxis.mockResolvedValue({ ok: true });
  });

  /** 未選択の意味が資産種別と非対称なので、画面上に明示する(B4) */
  it("集計対象を資産種別と負債の2グループに分け、未選択時の意味を出し分ける", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));

    expect(
      await screen.findByText(/1つも選ばない場合はすべての資産種別が対象になります/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/1つも選ばない場合は負債は差し引かない/u)).toBeInTheDocument();
  });

  it("選んだ負債を分類軸のdebtIdsとして保存する", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));
    await user.type(await screen.findByLabelText("分類名"), "純金融資産");
    await user.click(screen.getByRole("checkbox", { name: /住宅ローン/u }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith({
        name: "純金融資産",
        assetTypeNames: [],
        debtIds: ["debt-mortgage"],
      });
    });
  });

  /** 選択肢が出ないまま保存すると、選択済みの負債が黙って外れた軸で上書きされる */
  it("負債の選択肢を取得できないあいだは保存させない", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByText(/選択肢を読み込めるまで保存できません/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  /** 存在しない負債を選択中として出さない(B4) */
  it("B11で削除された負債への参照は編集フォームに出さず、保存し直せば消える", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "編集" }));
    await user.click(await screen.findByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateCategoryAxis).toHaveBeenCalledWith(
        "total-assets",
        expect.objectContaining({ debtIds: ["debt-mortgage"] }),
      );
    });
  });

  /**
   * フォームは初期値をマウント時に一度だけstateへ写し取るので、編集を開いたあとに負債の
   * 一覧が読み終わると、絞り込み前の値がstateに残る。そのまま保存すると「選択から
   * 外しました」と出しながら参照だけが書き戻り、案内と保存内容が食い違う(B11-2)。
   */
  it("編集を開いたあとに負債の一覧が読み終わっても、削除済みの参照を保存し直さない", async () => {
    const user = userEvent.setup();
    let resolveDebts: (result: DebtsResult) => void = () => {};
    fetchDebts.mockReturnValue(
      new Promise<DebtsResult>((resolve) => {
        resolveDebts = resolve;
      }),
    );
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    // 負債の選択肢がまだ読めていない状態で編集フォームを開く(この時点では絞り込めない)
    await user.click(await screen.findByRole("button", { name: "編集" }));
    expect(await screen.findByText(/負債の選択肢を読み込んでいます/u)).toBeInTheDocument();

    resolveDebts({ ok: true, debts: [mortgage] });

    // 読み終わってから保存する。住宅ローンのチェックには触らない
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(updateCategoryAxis).toHaveBeenCalledWith(
        "total-assets",
        expect.objectContaining({ debtIds: ["debt-mortgage"] }),
      );
    });
  });

  /**
   * 黙って外すと、分類軸が何を差し引いているかが変わったことに気付けない(B11-2)。
   * B8が対象分類の削除で既定へ戻すときに出しているのと同じ扱い。
   */
  it("編集フォームでは、外した参照の件数と保存で消えることを案内する", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "編集" }));

    expect(
      await screen.findByText(/負債のうち1件が見つからないため、選択から外しました/u),
    ).toBeInTheDocument();
    // エラーではなく集計の基準が変わった事実の通知なので、保存自体は妨げない
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  /** 新規追加は参照を持たないので、案内が出てはいけない */
  it("新規追加のフォームには外した参照の案内を出さない", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByRole("checkbox", { name: /住宅ローン/u })).toBeInTheDocument();
    expect(screen.queryByText(/選択から外しました/u)).not.toBeInTheDocument();
  });

  /** 負債を含む軸かどうかが一覧で分からないと、B1の値が資産合計と違う理由が追えない */
  it("一覧には負債を含む軸だけ件数を添える", async () => {
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [TOTAL_ASSETS_AXIS, { ...NET_FINANCIAL_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    expect(await screen.findByText(/負債 1件/u)).toBeInTheDocument();
    expect(screen.getByText("すべての資産種別が対象")).toBeInTheDocument();
  });

  /**
   * 件数を参照の数で出すと、一覧の「負債 2件」とB1で差し引かれている額が食い違い、
   * 一覧に件数を出した目的そのものを外す(B11-2)。
   */
  it("一覧の件数は実際に差し引かれる負債の数で出し、削除済みの件数を別に添える", async () => {
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...NET_FINANCIAL_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    expect(await screen.findByText(/負債 1件/u)).toBeInTheDocument();
    expect(screen.getByText("(1件は削除済み)")).toBeInTheDocument();
  });

  /**
   * 登録済みの負債が分からない状態では削除済みかどうかを判定できない。
   * 「取得に失敗しただけ」を「削除された」と読ませない(B11-2)。
   */
  it("負債の選択肢を取得できないあいだは、一覧に削除済みの件数を出さない", async () => {
    fetchDebts.mockResolvedValue({ ok: false, reason: "unknown" });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...NET_FINANCIAL_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    expect(await screen.findByText(/負債 2件/u)).toBeInTheDocument();
    expect(screen.queryByText(/は削除済み/u)).not.toBeInTheDocument();
  });

  /** 集計対象が割り当てられた軸を消させない制約を資産・負債で分ける理由が無い(B4) */
  it("負債だけが紐づいている分類の削除もブロックする", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
  });

  /**
   * 参照が残っているだけの軸は何も集計していない。ブロックの理由(集計対象がある)と
   * 実態が食い違うので、参照の件数ではなく実際に差し引かれる件数で判定する(B4-3)。
   */
  it("参照している負債がすべてB11で削除済みなら削除できる", async () => {
    const user = userEvent.setup();
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-deleted"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
  });

  it("削除済みの参照に混じって生きている負債が1件でも残っていればブロックする", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage", "debt-deleted"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
    expect(deleteCategoryAxis).not.toHaveBeenCalled();
  });

  /**
   * 取得に失敗しただけの状態を「集計対象が紐づいている」と読ませない(B11-2の一覧表示と
   * 同じ考え方)。止めはするが、理由は別の文言で示す。
   */
  it("負債の情報を取得できないあいだは削除を止め、判定できない旨を出す", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: false, reason: "unknown" });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類を削除できるか判定できません")).toBeInTheDocument();
    expect(screen.getByText(/負債の情報を取得できなかったため/u)).toBeInTheDocument();
    expect(screen.queryByText(/先に編集で割り当てを解除してください/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
    expect(deleteCategoryAxis).not.toHaveBeenCalled();
  });

  /**
   * 読み込み中は待てば必ず判定できるようになる。取得失敗と同じ文言にすると、
   * 待てば済むユーザーに再試行を促すことになる。
   */
  it("負債を読み込んでいるあいだは、再試行ではなく待つよう伝える", async () => {
    const user = userEvent.setup();
    // 解決しないPromiseで読み込み中のまま留める
    fetchDebts.mockReturnValue(new Promise(() => {}));
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類を削除できるか判定できません")).toBeInTheDocument();
    expect(screen.getByText(/読み込みが終わるまでお待ちください/u)).toBeInTheDocument();
    expect(screen.queryByText(/もう一度お試しください/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
  });

  /**
   * 資産種別が紐づいている軸は、負債の情報が取れても削除できないままである。
   * ここで「時間をおいてもう一度」と促すと、永久に叶わない再試行を勧めることになる。
   */
  it("資産種別が紐づいた分類は、負債の取得に失敗していても確定ブロックの文言を出す", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({ ok: false, reason: "unknown" });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...NET_FINANCIAL_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.getByText(/先に編集で割り当てを解除してください/u)).toBeInTheDocument();
    expect(screen.queryByText(/時間をおいて画面を更新して/u)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
  });

  /**
   * 負債を1件も参照していない軸は、負債の取得に失敗していても判定できる。
   * 取得失敗を理由に、関係のない分類軸まで消せなくしない(B4-3)。
   */
  it("負債を参照していない分類は、負債の取得に失敗していても削除できる", async () => {
    const user = userEvent.setup();
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    fetchDebts.mockResolvedValue({ ok: false, reason: "unknown" });
    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [TOTAL_ASSETS_AXIS] });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
  });
});
