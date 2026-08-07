import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetCategoryMasterScreen } from "@/components/asset-categories/AssetCategoryMasterScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

import type { RenderResult } from "@testing-library/react";

const fetchCategoryAxes = vi.fn();
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

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const TOTAL_ASSETS_AXIS: AssetCategoryAxisDocument = {
  id: "total-assets",
  name: "総資産",
  assetTypeNames: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const NET_FINANCIAL_AXIS: AssetCategoryAxisDocument = {
  id: "net-financial",
  name: "純金融資産",
  assetTypeNames: ["預金・現金", "投資信託"],
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
    expect(screen.getByText(/先に紐づく資産種別の割り当てを解除してください/u)).toBeInTheDocument();
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
