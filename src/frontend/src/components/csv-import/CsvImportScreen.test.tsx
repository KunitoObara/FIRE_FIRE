import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CsvImportScreen } from "@/components/csv-import/CsvImportScreen";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";

import type { RenderResult } from "@testing-library/react";

const fetchImportHistory = vi.fn();

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchImportHistory: () => fetchImportHistory(),
}));

/** 取込そのものは`AssetBalanceImportPanel`側で検証済み。ここでは完了の通知だけを起こす */
vi.mock("@/components/csv-import/AssetBalanceImportPanel", () => ({
  AssetBalanceImportPanel: ({ onImported }: AssetBalanceImportPanelProps) => (
    <button type="button" onClick={onImported}>
      取込完了を通知する
    </button>
  ),
}));

/** 保存後にどのキーを無効化したかを確かめるため、画面と同じインスタンスを掴んでおく */
let queryClient: QueryClient;

const renderScreen = (): RenderResult => {
  queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <CsvImportScreen />
    </QueryClientProvider>,
  );
};

describe("CsvImportScreen", () => {
  beforeEach(() => {
    fetchImportHistory.mockReset();
    fetchImportHistory.mockResolvedValue({ ok: true, entries: [] });
  });

  /** 取り込んだ残高はB1の表示内容そのもの。B1に戻ったときに古い集計を見せない */
  it("取込が完了したら取込履歴とB1の表示データを取り直させる", async () => {
    const user = userEvent.setup();
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "取込完了を通知する" }));

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
    expect(fetchImportHistory).toHaveBeenCalledTimes(2);
  });
});
