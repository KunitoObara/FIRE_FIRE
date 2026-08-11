import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionImportPanel } from "@/components/csv-import/TransactionImportPanel";
import { MAX_CSV_FILE_BYTES } from "@/constants/csv-import";

const buildTransactionImportPlan = vi.fn();
const importTransactions = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/lib/csv-import/transaction-repository", () => ({
  buildTransactionImportPlan: (...args: unknown[]) => buildTransactionImportPlan(...args),
  importTransactions: (...args: unknown[]) => importTransactions(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

/**
 * 検証用の入出金明細CSV(値はすべて架空。実際のエクスポートの数値も`ID`も置かない)。
 *
 * 4行のうち1行が振替、1行が計算対象外で、どちらもB1の収支サマリからは外れる
 * (docs/transaction-import-requirements.md 5章)。
 */
const VALID_CSV = [
  '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"',
  '"1","2026/07/31","スーパー〇〇","-3,200","〇〇銀行","食費","食料品","","0","aaaa1111"',
  '"1","2026/07/15","給与","300000","〇〇銀行","収入","給与","","0","aaaa2222"',
  '"1","2026/07/10","証券口座へ入金","-100000","〇〇銀行","振替","振替","","1","aaaa3333"',
  '"0","2026/07/05","立替分","-5000","〇〇カード","その他","","","0","aaaa4444"',
].join("\r\n");

/** 期間で見分けられるようにした別のCSV。選び直しの検証で「どちらが表示されているか」を見る */
const OTHER_CSV = [
  '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"',
  '"1","2020/01/31","カフェ〇〇","-500","〇〇銀行","食費","カフェ","","0","bbbb1111"',
].join("\r\n");

/**
 * 選択させるCSVファイルを作る。
 *
 * ブラウザにShift_JISのエンコーダは無いのでここではUTF-8で作る。実ファイルのShift_JISを
 * 読めることは`src/lib/csv/decode.test.ts`で個別に検証している。
 */
const buildCsvFile = (text: string, name = "収入支出詳細_202607.csv"): File =>
  new File([text], name, { type: "text/csv" });

const selectFile = async (file: File): Promise<void> => {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText("CSVファイル"), file);
};

describe("TransactionImportPanel", () => {
  beforeEach(() => {
    buildTransactionImportPlan.mockReset();
    importTransactions.mockReset();
    toastSuccess.mockReset();
    buildTransactionImportPlan.mockResolvedValue({
      ok: true,
      plan: { newCount: 4, updatedCount: 0 },
    });
    importTransactions.mockResolvedValue({ ok: true, writtenCount: 4 });
  });

  it("パースに成功すると件数・期間・サンプル行を出して実行前確認を求める", async () => {
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    const summary = await screen.findByTestId("transaction-import-summary");
    expect(summary).toHaveTextContent("4件");
    expect(summary).toHaveTextContent("2026-07-05〜2026-07-31");
    expect(screen.getByRole("cell", { name: "スーパー〇〇" })).toBeInTheDocument();
    // 桁区切りのカンマが入った金額も符号ごと読み取れている
    expect(screen.getByRole("cell", { name: "- ¥ 3,200" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "食費 / 食料品" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取込を実行する" })).toBeEnabled();
  });

  /** 中項目が空の取引に「(未分類)」のような名前をアプリ側で与えない(同書6章) */
  it("中項目が空の取引は大項目だけを出す", async () => {
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    expect(await screen.findByRole("cell", { name: "その他" })).toBeInTheDocument();
  });

  /**
   * 振替だらけのファイルを取り込んで収支サマリが動かないとき、その理由が取込の**前**に
   * 分かるようにするための表示(同書7章)
   */
  it("収支の集計から外れる件数を振替・計算対象外の内訳つきで出す", async () => {
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    const summary = await screen.findByTestId("transaction-import-summary");
    expect(summary).toHaveTextContent("収支の集計から外れる取引: 2件");
    expect(summary).toHaveTextContent("振替 1件");
    expect(summary).toHaveTextContent("計算対象外 1件");
    // 外れた行も取り込まれ、B3には出る(取込に失敗したのだと読み違えさせない)
    expect(summary).toHaveTextContent("いずれも取り込まれ");
  });

  it("既存データと突き合わせて新規・上書きの件数を出す", async () => {
    buildTransactionImportPlan.mockResolvedValue({
      ok: true,
      plan: { newCount: 3, updatedCount: 1 },
    });
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    await waitFor(() => {
      expect(screen.getByTestId("transaction-import-summary")).toHaveTextContent("上書き 1件");
    });
  });

  /** 既存データを引けなくてもファイルの中身は確認できるので、プレビュー自体は残す */
  it("既存データを照会できなくてもプレビューは出す", async () => {
    buildTransactionImportPlan.mockResolvedValue({ ok: false, reason: "signed-out" });
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));

    expect(await screen.findByTestId("transaction-import-summary")).toHaveTextContent("4件");
  });

  it("パースに失敗するとエラーを出し、取込を実行できないまま画面に留まる", async () => {
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile('"日付","合計（円）"\n"2026/07/31","100"', "資産推移.csv"));

    expect(await screen.findByRole("alert")).toHaveTextContent("CSVの形式を読み取れませんでした");
    expect(screen.queryByRole("button", { name: "取込を実行する" })).not.toBeInTheDocument();
  });

  /**
   * 同じ`ID`が2度現れると、どちらの内容で上書きするかがファイル内の順序で決まる。
   * 資産残高推移とは失敗の理由が違うので、入出金明細向けの文言が出ることまで見る
   */
  it("同じ取引IDの行が重複していれば、その行を示して取り込ませない", async () => {
    const duplicated = [
      VALID_CSV,
      '"1","2026/07/01","重複","-100","〇〇銀行","食費","食料品","","0","aaaa1111"',
    ].join("\r\n");
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(duplicated));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("同じ取引IDの行が重複しています");
    expect(alert).toHaveTextContent("6行目");
  });

  /**
   * ファイルサイズの歯止めは資産残高推移と共通(`MAX_CSV_FILE_BYTES`)。
   * 取り違えて巨大なファイルを選んだときに、読み込んで固まる前に止める
   */
  it("上限を超えるファイルは読み込まずに断る", async () => {
    const file = buildCsvFile(VALID_CSV, "巨大.csv");
    // 実際に5MBのファイルを作るとテストが重いので、大きさだけを偽装する
    Object.defineProperty(file, "size", { value: MAX_CSV_FILE_BYTES + 1 });
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(file);

    expect(await screen.findByRole("alert")).toHaveTextContent("ファイルサイズが大きすぎます");
    expect(screen.queryByTestId("transaction-import-summary")).not.toBeInTheDocument();
    expect(buildTransactionImportPlan).not.toHaveBeenCalled();
  });

  it("キャンセルするとプレビューを破棄してファイル未選択に戻す", async () => {
    const user = userEvent.setup();
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByTestId("transaction-import-summary")).not.toBeInTheDocument();
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

    buildTransactionImportPlan
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSlow = resolve;
        }),
      )
      .mockResolvedValueOnce(fastPlan);

    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV, "先に選んだ.csv"));
    await selectFile(buildCsvFile(OTHER_CSV, "後から選んだ.csv"));

    await waitFor(() => {
      expect(screen.getByTestId("transaction-import-summary")).toHaveTextContent("新規 1件");
    });

    // ここで1回目の照会がようやく返る
    resolveSlow(slowPlan);

    await waitFor(() => {
      expect(screen.getByText(/選択中: 後から選んだ.csv/u)).toBeInTheDocument();
    });
    const summary = screen.getByTestId("transaction-import-summary");
    expect(summary).toHaveTextContent("2020-01-31");
    expect(summary).not.toHaveTextContent("99件");
  });

  it("取込を実行すると完了を通知し、続けて取り込める状態に戻す", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    render(<TransactionImportPanel onImported={onImported} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("取込が完了しました(4件を反映しました)");
    });
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("transaction-import-summary")).not.toBeInTheDocument();
  });

  /**
   * 二重実行(B11で実際に出た欠陥の型)。ドキュメントIDがマネーフォワードの`ID`なので
   * 2回書いても件数は増えないが、押した回数だけ書き込みが飛ぶ状態は放置しない
   */
  it("取込中は「取込を実行する」を続けて押しても2回実行しない", async () => {
    const user = userEvent.setup();
    let resolveImport: (value: unknown) => void = () => {};
    importTransactions.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    const importButton = screen.getByRole("button", { name: "取込を実行する" });
    await user.click(importButton);

    const busyButton = await screen.findByRole("button", { name: "取込中…" });
    expect(busyButton).toBeDisabled();
    await user.click(busyButton);

    expect(importTransactions).toHaveBeenCalledOnce();

    resolveImport({ ok: true, writtenCount: 4 });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledOnce();
    });
  });

  /**
   * 500件超の取込は複数バッチに分かれ、途中で失敗しても手前は確定済みで残る。
   * 「失敗した=何も変わっていない」と受け取られると実際の状態と食い違う
   */
  it("途中まで反映されて失敗した場合は、反映済みの件数と次の行動を伝える", async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    importTransactions.mockResolvedValue({ ok: false, reason: "unknown", writtenCount: 500 });
    render(<TransactionImportPanel onImported={onImported} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("500件はすでに反映されています");
    expect(alert).toHaveTextContent("同じ取引IDは上書きされます");
    // データは変わっているので取込履歴とB1・B3のキャッシュを取り直させる
    expect(onImported).toHaveBeenCalledOnce();
  });

  it("履歴だけ残せなかった場合は、取り込み直す必要が無いことを伝える", async () => {
    const user = userEvent.setup();
    importTransactions.mockResolvedValue({
      ok: false,
      reason: "history-write-failed",
      writtenCount: 4,
    });
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("取引は反映しましたが");
    expect(alert).toHaveTextContent("取り込み直す必要はありません");
    expect(alert).not.toHaveTextContent("残りも揃います");
  });

  it("取込に失敗したらプレビューを残したまま理由を出す", async () => {
    const user = userEvent.setup();
    importTransactions.mockResolvedValue({ ok: false, reason: "signed-out", writtenCount: 0 });
    render(<TransactionImportPanel onImported={vi.fn()} />);

    await selectFile(buildCsvFile(VALID_CSV));
    await screen.findByTestId("transaction-import-summary");
    await user.click(screen.getByRole("button", { name: "取込を実行する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ログイン状態が切れています");
    expect(screen.getByRole("button", { name: "取込を実行する" })).toBeInTheDocument();
  });
});
