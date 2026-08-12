import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CsvImportScreen } from "@/components/csv-import/CsvImportScreen";
import { CASHFLOW_DATA_QUERY_KEY, DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import { TRANSACTIONS_DATA_QUERY_KEY } from "@/constants/transactions";

import type { RenderResult } from "@testing-library/react";

const fetchImportHistory = vi.fn();

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  fetchImportHistory: () => fetchImportHistory(),
}));

/** 取込そのものは各パネル側で検証済み。ここでは完了の通知だけを起こす */
vi.mock("@/components/csv-import/AssetBalanceImportPanel", () => ({
  AssetBalanceImportPanel: ({ onImported }: AssetBalanceImportPanelProps) => (
    <button type="button" onClick={onImported}>
      資産残高推移の取込完了を通知する
    </button>
  ),
}));

vi.mock("@/components/csv-import/TransactionImportPanel", () => ({
  TransactionImportPanel: ({ onImported }: TransactionImportPanelProps) => (
    <button type="button" onClick={onImported}>
      入出金明細の取込完了を通知する
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
  it("資産残高推移の取込が完了したら取込履歴とB1の表示データを取り直させる", async () => {
    const user = userEvent.setup();
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(
      await screen.findByRole("button", { name: "資産残高推移の取込完了を通知する" }),
    );

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: TRANSACTIONS_DATA_QUERY_KEY });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: CASHFLOW_DATA_QUERY_KEY });
    expect(fetchImportHistory).toHaveBeenCalledTimes(2);
  });

  /**
   * 取り込んだ取引はB3の一覧とB1の収支サマリそのもの
   * (docs/screen-requirements-dashboard.md B2「入出金明細タブ」)
   */
  it("入出金明細の取込が完了したら取込履歴とB1・B3の表示データを取り直させる", async () => {
    const user = userEvent.setup();
    renderScreen();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "入出金明細の取込完了を通知する" }));

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DASHBOARD_DATA_QUERY_KEY });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: TRANSACTIONS_DATA_QUERY_KEY });
    /*
      収支サマリは月ごとにキャッシュを分けているので、前方一致で落としてどの月で見ていた分も
      一度に無効化する(docs/screen-requirements-dashboard.md B1「年月の選択」)
    */
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: CASHFLOW_DATA_QUERY_KEY });
    expect(fetchImportHistory).toHaveBeenCalledTimes(2);
  });

  /** 未実装の案内(`UNIMPLEMENTED_IMPORT_TYPE_NOTICE`)は両種別の実装で外した */
  it("両方の取込種別タブに取込パネルを出す", async () => {
    renderScreen();

    expect(
      await screen.findByRole("button", { name: "資産残高推移の取込完了を通知する" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "入出金明細の取込完了を通知する" }),
    ).toBeInTheDocument();
  });
});
