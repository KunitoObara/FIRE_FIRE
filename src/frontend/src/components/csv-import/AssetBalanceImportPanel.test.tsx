import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetBalanceImportPanel } from "@/components/csv-import/AssetBalanceImportPanel";

const buildImportPlan = vi.fn();
const importAssetBalances = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/csv-import/asset-balance-repository", () => ({
  buildImportPlan: (...args: unknown[]) => buildImportPlan(...args),
  importAssetBalances: (...args: unknown[]) => importAssetBalances(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const VALID_CSV = [
  '"日付","合計（円）","預金・現金（円）"',
  '"2026/07/31","12000000","5000000"',
  '"2026/06/30","11000000","4500000"',
].join("\r\n");

/** 期間で見分けられるようにした別のCSV。選び直しの検証で「どちらが表示されているか」を見る */
const OTHER_CSV = [
  '"日付","合計（円）","預金・現金（円）"',
  '"2020/01/31","1000000","1000000"',
].join("\r\n");

/**
 * 選択させるCSVファイルを作る。
 *
 * ブラウザにShift_JISのエンコーダは無いのでここではUTF-8で作る。実ファイルのShift_JISを
 * 読めることは`src/lib/csv/decode.test.ts`で個別に検証している。
 */
const buildCsvFile = (text: string, name = "資産推移月次.csv"): File =>
  new File([text], name, { type: "text/csv" });

const selectFile = async (file: File): Promise<void> => {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText("CSVファイル"), file);
};

describe("AssetBalanceImportPanel", () => {
  beforeEach(() => {
    buildImportPlan.mockReset();
    importAssetBalances.mockReset();
    toastSuccess.mockReset();
    buildImportPlan.mockResolvedValue({ ok: true, plan: { newCount: 2, updatedCount: 0 } });
    importAssetBalances.mockResolvedValue({ ok: true, writtenCount: 2 });
  });

  it("パースに成功すると件数・期間・サンプル行を出して実行前確認を求める", async () => {
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    const summary = await screen.findByTestId("csv-import-summary");
    expect(summary).toHaveTextContent("2件");
    expect(summary).toHaveTextContent("2026-06-30〜2026-07-31");
    expect(screen.getByRole("columnheader", { name: "預金・現金" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取込を実行する" })).toBeEnabled();
  });

  it("既存データと突き合わせて新規・上書きの件数を出す", async () => {
    buildImportPlan.mockResolvedValue({ ok: true, plan: { newCount: 1, updatedCount: 1 } });
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    await waitFor(() => {
      expect(screen.getByTestId("csv-import-summary")).toHaveTextContent("上書き 1件");
    });
  });

  /** 既存データを引けなくてもファイルの中身は確認できるので、プレビュー自体は残す */
  it("既存データを照会できなくてもプレビューは出す", async () => {
    buildImportPlan.mockResolvedValue({ ok: false, reason: "signed-out" });
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    expect(await screen.findByTestId("csv-import-summary")).toHaveTextContent("2件");
  });

  it("パースに失敗するとエラーを出し、取込を実行できないまま画面に留まる", async () => {
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile('"年月","残高"\n"2026/07","100"', "別形式.csv"));

    expect(await screen.findByRole("alert")).toHaveTextContent("CSVの形式を読み取れませんでした");
    expect(screen.queryByRole("button", { name: "取込を実行する" })).not.toBeInTheDocument();
  });

  it("キャンセルするとプレビューを破棄してファイル未選択に戻す", async () => {
    const user = userEvent.setup();
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("csv-import-summary");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByTestId("csv-import-summary")).not.toBeInTheDocument();
    expect(screen.queryByText(/選択中:/u)).not.toBeInTheDocument();
  });

  /**
   * 既存データの照会が遅れて返る間に別のファイルを選び直したときの取り違え。
   * 画面に出ているファイル名と、実際に取り込まれる中身がずれると影響が大きい。
   */
  it("読み込み中に選び直すと、古いファイルの結果でプレビューを上書きしない", async () => {
    const slowPlan = { ok: true, plan: { newCount: 99, updatedCount: 99 } };
    const fastPlan = { ok: true, plan: { newCount: 1, updatedCount: 0 } };
    let resolveSlow: (value: unknown) => void = () => {};

    buildImportPlan
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSlow = resolve;
        }),
      )
      .mockResolvedValueOnce(fastPlan);

    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV, "先に選んだ.csv"));
    await selectFile(buildCsvFile(OTHER_CSV, "後から選んだ.csv"));

    await waitFor(() => {
      expect(screen.getByTestId("csv-import-summary")).toHaveTextContent("新規 1件");
    });

    // ここで1回目の照会がようやく返る
    resolveSlow(slowPlan);

    await waitFor(() => {
      expect(screen.getByText(/選択中: 後から選んだ.csv/u)).toBeInTheDocument();
    });
    const summary = screen.getByTestId("csv-import-summary");
    expect(summary).toHaveTextContent("2020-01-31");
    expect(summary).not.toHaveTextContent("99件");
  });

  it("取込を実行すると完了を通知し、続けて取り込める状態に戻す", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    render(<AssetBalanceImportPanel onImported={onImported} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("csv-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("取込が完了しました(2件を反映しました)");
    });
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("csv-import-summary")).not.toBeInTheDocument();
  });

  /**
   * 500件超の取込は複数バッチに分かれ、途中で失敗しても手前は確定済みで残る。
   * 「失敗した=何も変わっていない」と受け取られると実際の状態と食い違う。
   */
  it("途中まで反映されて失敗した場合は、反映済みの件数と次の行動を伝える", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    importAssetBalances.mockResolvedValue({ ok: false, reason: "unknown", writtenCount: 500 });
    render(<AssetBalanceImportPanel onImported={onImported} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("csv-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("500件はすでに反映されています");
    expect(alert).toHaveTextContent("取り込み直すと残りも揃います");
    // データは変わっているので取込履歴を取り直させる
    expect(onImported).toHaveBeenCalledOnce();
  });

  it("履歴だけ残せなかった場合は、取り込み直す必要が無いことを伝える", async () => {
    const user = userEvent.setup();
    importAssetBalances.mockResolvedValue({
      ok: false,
      reason: "history-write-failed",
      writtenCount: 2,
    });
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("csv-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("取り込み直す必要はありません");
    expect(alert).not.toHaveTextContent("残りも揃います");
  });

  it("取込に失敗したらプレビューを残したまま理由を出す", async () => {
    const user = userEvent.setup();
    importAssetBalances.mockResolvedValue({ ok: false, reason: "signed-out", writtenCount: 0 });
    render(<AssetBalanceImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("csv-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ログイン状態が切れています");
    expect(screen.getByRole("button", { name: "取込を実行する" })).toBeInTheDocument();
  });
});
