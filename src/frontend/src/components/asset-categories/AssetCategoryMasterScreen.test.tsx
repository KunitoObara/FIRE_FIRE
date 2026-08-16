import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetCategoryMasterScreen } from "@/components/asset-categories/AssetCategoryMasterScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

import type { RenderResult } from "@testing-library/react";

const fetchCategoryAxes = vi.fn();
const fetchDebts = vi.fn();
const fetchRealEstateProperties = vi.fn();
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

vi.mock("@/lib/real-estate/property-repository", () => ({
  fetchRealEstateProperties: (...args: unknown[]) => fetchRealEstateProperties(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const TOTAL_ASSETS_AXIS: AssetCategoryAxisDocument = {
  id: "total-assets",
  name: "総資産",
  assetTypeNames: [],
  debtIds: [],
  propertyValuations: {},
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NET_FINANCIAL_AXIS: AssetCategoryAxisDocument = {
  id: "net-financial",
  name: "純金融資産",
  assetTypeNames: ["預金・現金", "投資信託"],
  debtIds: [],
  propertyValuations: {},
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
    // 物件の選択肢(B4「集計対象に不動産を含める」)。負債と同じ理由で、既定は取得成功・0件
    fetchRealEstateProperties.mockReset();
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: [] });
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
        propertyValuations: {},
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
        propertyValuations: {},
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
        propertyValuations: {},
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
    originatedOn: null,
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
        propertyValuations: {},
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
    expect(screen.getByText(/負債・不動産の情報を取得できなかったため/u)).toBeInTheDocument();
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
   * 「判定できません」は**待てば解ける状態**であって行き止まりではない。ダイアログを開いたまま
   * 負債の取得が終われば、そのまま通常の確認へ切り替わる。
   *
   * 現在の実装は`debtOptions`から都度導くので自然にこうなるが、**壊れたときの症状は
   * 「ダイアログが『判定できません』のまま固まる」**で、ユーザーからは削除機能が壊れたように
   * しか見えない。参照の判定を`useState`や依存配列付きの`useMemo`で保持する形に変えると
   * この性質は黙って失われるため、テストで固定しておく。
   */
  it("ダイアログを開いたまま負債を読み終えたら、通常の確認へ切り替わる", async () => {
    const user = userEvent.setup();
    let resolveDebts: (result: unknown) => void = () => {};
    fetchDebts.mockReturnValue(
      new Promise((resolve) => {
        resolveDebts = resolve;
      }),
    );
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    // 参照している負債はB11で削除済み。読み終われば「集計していない軸」として削除できる
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-deleted"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    expect(await screen.findByText("この分類を削除できるか判定できません")).toBeInTheDocument();

    // ダイアログを開いたまま取得が完了する
    resolveDebts({ ok: true, debts: [mortgage] });

    expect(await screen.findByRole("button", { name: "削除する" })).toBeInTheDocument();
    expect(screen.queryByText("この分類を削除できるか判定できません")).not.toBeInTheDocument();

    // 切り替わった先がただの表示ではなく、実際に削除まで進めることまで見る
    await user.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
  });

  /** 切り替わる先は確定ブロックのこともある。どちらであれ「判定できません」のまま固まらない */
  it("ダイアログを開いたまま読み終えた結果、生きている負債が残っていれば確定ブロックへ切り替わる", async () => {
    const user = userEvent.setup();
    let resolveDebts: (result: unknown) => void = () => {};
    fetchDebts.mockReturnValue(
      new Promise((resolve) => {
        resolveDebts = resolve;
      }),
    );
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    expect(await screen.findByText("この分類を削除できるか判定できません")).toBeInTheDocument();

    resolveDebts({ ok: true, debts: [mortgage] });

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.queryByText("この分類を削除できるか判定できません")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
    expect(deleteCategoryAxis).not.toHaveBeenCalled();
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

describe("AssetCategoryMasterScreen(不動産)", () => {
  /** B5〜B7で登録済みの物件。物件名は重複を許すので、簡略表記の所在地で見分ける(B4) */
  const SHIBUYA: RealEstateProperty = {
    id: "shibuya-101",
    name: "〇〇マンション101号室",
    location: "東京都渋谷区神南1-2-3",
    acquiredOn: "2019-04",
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
    updatedAt: "2026-06-01",
    valueHistory: {},
  };

  const YOKOHAMA: RealEstateProperty = {
    id: "yokohama-202",
    name: "△△アパート202号室",
    location: "",
    acquiredOn: null,
    marketValue: 21_500_000,
    loanBalance: 15_200_000,
    updatedAt: "2026-05-02",
    valueHistory: {},
  };

  /*
    describeごとにモックを組み直す(このファイルの他のブロックと同じ作り)。
    前のブロックが残した戻り値を引き継ぐと、保存できない状態から始まるテストが混ざる
  */
  beforeEach(() => {
    fetchCategoryAxes.mockReset();
    fetchAssetTypeOptions.mockReset();
    createCategoryAxis.mockReset();
    updateCategoryAxis.mockReset();
    deleteCategoryAxis.mockReset();
    fetchDebts.mockReset();
    fetchRealEstateProperties.mockReset();
    toastSuccess.mockReset();

    fetchCategoryAxes.mockResolvedValue({ ok: true, axes: [TOTAL_ASSETS_AXIS] });
    fetchAssetTypeOptions.mockResolvedValue({ ok: true, assetTypeNames: ["預金・現金"] });
    fetchDebts.mockResolvedValue({ ok: true, debts: [] });
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: [SHIBUYA, YOKOHAMA] });
    createCategoryAxis.mockResolvedValue({ ok: true });
    updateCategoryAxis.mockResolvedValue({ ok: true });
  });

  /**
   * 選んだ物件は既定で「利ざやのみ反映」になる(B4)。時価を既定にすると、ローンが
   * 残っている物件を選んだ瞬間に控除前の額がダッシュボードへ載る。
   */
  it("選んだ物件を既定の利ざやで保存する", async () => {
    const user = userEvent.setup();
    createCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "総資産(不動産込み)");
    await user.click(await screen.findByLabelText(/〇〇マンション101号室/u));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith(
        expect.objectContaining({ propertyValuations: { "shibuya-101": "spread" } }),
      );
    });
  });

  it("「利ざやのみ反映」を外すと時価で保存する", async () => {
    const user = userEvent.setup();
    createCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "総資産(不動産込み)");
    await user.click(await screen.findByLabelText(/〇〇マンション101号室/u));
    await user.click(screen.getByLabelText(/利ざやのみ反映/u));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith(
        expect.objectContaining({ propertyValuations: { "shibuya-101": "marketValue" } }),
      );
    });
  });

  /**
   * 反映方法は選んだ物件の行にだけ出す。選んでいない物件に残っていると、何が集計されるのかが
   * 行から読めない(B4)。外した物件の反映方法も保存しない — 画面に出ていない設定が
   * 保存され続けることになるため。
   */
  it("選択を外すと反映方法の選択肢も消え、保存にも残らない", async () => {
    const user = userEvent.setup();
    createCategoryAxis.mockResolvedValue({ ok: true });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));
    await user.type(screen.getByLabelText("分類名"), "総資産");
    expect(screen.queryByLabelText(/利ざやのみ反映/u)).not.toBeInTheDocument();

    const propertyCheckbox = await screen.findByLabelText(/〇〇マンション101号室/u);
    await user.click(propertyCheckbox);
    expect(screen.getByLabelText(/利ざやのみ反映/u)).toBeInTheDocument();

    await user.click(propertyCheckbox);
    expect(screen.queryByLabelText(/利ざやのみ反映/u)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(createCategoryAxis).toHaveBeenCalledWith(
        expect.objectContaining({ propertyValuations: {} }),
      );
    });
  });

  /**
   * 上限は**選択数**で、登録件数は縛らない(B4)。分類名以外の失敗を分類名のエラーへ
   * 丸めると、物件を選びすぎただけの保存に「分類名を入力してください」と出て、
   * 直す場所が画面から分からなくなる。
   */
  it("選べる物件の上限を超えると、分類名ではなく件数のエラーを出す", async () => {
    const user = userEvent.setup();
    // 51件をクリックで選ぶと遅いので、上限を超えた軸を編集で開いて保存だけを試す
    const many = Array.from({ length: 51 }, (_, index) => ({
      ...SHIBUYA,
      id: `property-${String(index).padStart(2, "0")}`,
      name: `物件${String(index).padStart(2, "0")}`,
    }));
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: many });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        {
          ...TOTAL_ASSETS_AXIS,
          propertyValuations: Object.fromEntries(
            many.map((property) => [property.id, "spread" as const]),
          ),
        },
      ],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "編集" }));
    await user.click(await screen.findByRole("button", { name: "保存" }));

    expect(await screen.findByText(/選べる物件は50件までです/u)).toBeInTheDocument();
    expect(screen.queryByText("分類名を入力してください。")).not.toBeInTheDocument();
    expect(updateCategoryAxis).not.toHaveBeenCalled();
  });

  /**
   * 失敗した側だけを設定して戻ると、直したはずのエラーが残り続ける
   * ([PR #154](https://github.com/KunitoObara/FIRE_FIRE/pull/154) のレビュー指摘)。
   * 名前欄の `aria-invalid` も `nameError` を見ているので、有効な名前がエラー扱いのままになる。
   */
  it("分類名を直して物件の件数で失敗したとき、分類名のエラーを消す", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 51 }, (_, index) => ({
      ...SHIBUYA,
      id: `property-${String(index).padStart(2, "0")}`,
      name: `物件${String(index).padStart(2, "0")}`,
    }));
    fetchRealEstateProperties.mockResolvedValue({ ok: true, properties: many });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        {
          ...TOTAL_ASSETS_AXIS,
          name: "",
          propertyValuations: Object.fromEntries(
            many.map((property) => [property.id, "spread" as const]),
          ),
        },
      ],
    });
    renderScreen();

    // 1回目: 分類名が空のまま保存して名前のエラーを出す
    await user.click(await screen.findByRole("button", { name: "編集" }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    expect(await screen.findByText("分類名を入力してください。")).toBeInTheDocument();

    // 2回目: 名前を直すと、今度は物件の件数で失敗する
    await user.type(screen.getByLabelText("分類名"), "総資産");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText(/選べる物件は50件までです/u)).toBeInTheDocument();
    expect(screen.queryByText("分類名を入力してください。")).not.toBeInTheDocument();
    expect(screen.getByLabelText("分類名")).not.toHaveAttribute("aria-invalid", "true");
  });

  /** カードで指定された赤字の注意(B1「CSV取込データとの重複」) */
  it("CSV取込データとの重複の注意を出す", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByText(/CSV取込データとの重複に注意してください/u)).toBeInTheDocument();
    expect(screen.getByText(/二重に差し引きます/u)).toBeInTheDocument();
  });

  /** 選択肢が出ないまま保存すると、選択済みの物件が黙って外れた分類軸で上書きされる(B4) */
  it("物件の選択肢を取得できないあいだは保存させない", async () => {
    const user = userEvent.setup();
    fetchRealEstateProperties.mockResolvedValue({ ok: false, reason: "unknown" });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "新規分類を追加" }));

    expect(await screen.findByText(/選択肢を読み込めるまで保存できません/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("一覧には集計へ加わる物件の件数を出す", async () => {
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        {
          ...TOTAL_ASSETS_AXIS,
          propertyValuations: { "shibuya-101": "spread", "yokohama-202": "marketValue" },
        },
      ],
    });
    renderScreen();

    expect(await screen.findByText(/不動産 2件/u)).toBeInTheDocument();
  });

  /**
   * 削除された物件への参照は集計対象から外れたものとして扱い、外したことを一覧にも出す
   * (負債とすべて同じ扱い。B4)。件数は実際に集計へ加わる数で出す。
   */
  it("削除済みの物件への参照は件数から除き、削除済みである旨を添える", async () => {
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [
        {
          ...TOTAL_ASSETS_AXIS,
          propertyValuations: { "shibuya-101": "spread", "sold-out": "spread" },
        },
      ],
    });
    renderScreen();

    expect(await screen.findByText(/不動産 1件/u)).toBeInTheDocument();
    expect(screen.getByText(/1件は削除済み/u)).toBeInTheDocument();
  });

  /**
   * 判定できない原因の文言は、**その軸が参照している側**の取得状態だけで決める
   * ([PR #154](https://github.com/KunitoObara/FIRE_FIRE/pull/154) のレビュー指摘)。
   * 無関係な側の失敗を拾うと、待てば解決する状態に再試行を促すことになる。
   */
  it("負債だけを参照する軸では、無関係な物件側の取得失敗で再試行を促さない", async () => {
    const user = userEvent.setup();
    // 負債は読み込み中のまま、物件(この軸には無関係)だけ取得失敗にする
    fetchDebts.mockReturnValue(new Promise(() => {}));
    fetchRealEstateProperties.mockResolvedValue({ ok: false, reason: "unknown" });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類を削除できるか判定できません")).toBeInTheDocument();
    expect(screen.getByText(/読み込みが終わるまでお待ちください/u)).toBeInTheDocument();
    expect(screen.queryByText(/もう一度お試しください/u)).not.toBeInTheDocument();
  });

  /** 集計対象が割り当てられた軸を消させない制約を、資産・負債・不動産で分ける理由が無い(B4) */
  it("物件だけが紐づいている分類の削除もブロックする", async () => {
    const user = userEvent.setup();
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, propertyValuations: { "shibuya-101": "spread" } }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
  });

  /** 参照が残っているだけの軸は何も集計していない(負債と同じ判定。B4-3) */
  it("参照している物件がすべて削除済みなら削除できる", async () => {
    const user = userEvent.setup();
    deleteCategoryAxis.mockResolvedValue({ ok: true });
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, propertyValuations: { "sold-out": "spread" } }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleteCategoryAxis).toHaveBeenCalledWith("total-assets");
    });
  });

  /**
   * 負債と物件で状態が揃わないことがある(負債は取得済みで集計対象あり、物件は読み込み中)。
   * 片方だけを見ると「削除できない」と「判定できない」が同時に成立するので、確定して
   * ブロックされるほうを優先する。
   */
  it("負債で確定してブロックされる軸は、物件が読み込み中でも削除禁止と伝える", async () => {
    const user = userEvent.setup();
    fetchDebts.mockResolvedValue({
      ok: true,
      debts: [
        {
          id: "debt-mortgage",
          name: "住宅ローン",
          balance: 18_400_000,
          originatedOn: null,
          interestRate: null,
          repaymentMonths: null,
          updatedAt: "2026-07-12",
          balanceHistory: {},
        },
      ],
    });
    // 解決しないPromiseで物件だけを読み込み中のまま留める
    fetchRealEstateProperties.mockReturnValue(new Promise(() => {}));
    fetchCategoryAxes.mockResolvedValue({
      ok: true,
      axes: [{ ...TOTAL_ASSETS_AXIS, debtIds: ["debt-mortgage"] }],
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "削除" }));

    expect(await screen.findByText("この分類は削除できません")).toBeInTheDocument();
    expect(screen.queryByText("この分類を削除できるか判定できません")).not.toBeInTheDocument();
  });
});
