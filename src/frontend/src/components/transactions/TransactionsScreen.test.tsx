import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionsScreen } from "@/components/transactions/TransactionsScreen";
import { TRANSACTION_SCAN_LIMIT } from "@/constants/transactions";

import type { RenderResult } from "@testing-library/react";

const fetchTransactionsData = vi.fn();

vi.mock("@/lib/transactions/transactions-data", () => ({
  fetchTransactionsData: (...args: unknown[]) => fetchTransactionsData(...args),
}));

/** 絞り込みバーの送信先。ここでは押さないので記録だけできればよい */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const buildTransaction = (transaction: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-07-20",
  content: "スーパー〇〇",
  amount: -3_280,
  account: "〇〇カード",
  categoryMajor: "食費",
  categoryMinor: "食料品",
  memo: "",
  isTransfer: false,
  isCalculationTarget: true,
  ...transaction,
});

const resolveData = (transactions: Transaction[], truncated = false): void => {
  const categories = [...new Set(transactions.map((transaction) => transaction.categoryMajor))];

  fetchTransactionsData.mockResolvedValue({
    ok: true,
    truncated,
    data: {
      transactions,
      categories,
      categoryMinorsByMajor: Object.fromEntries(
        categories.map((major) => [
          major,
          [
            ...new Set(
              transactions
                .filter((transaction) => transaction.categoryMajor === major)
                .map((transaction) => transaction.categoryMinor)
                .filter((minor) => minor),
            ),
          ],
        ]),
      ),
      accounts: [...new Set(transactions.map((transaction) => transaction.account))],
    },
  });
};

const renderScreen = (
  searchParams: Record<string, string | string[] | undefined> = {},
): RenderResult =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TransactionsScreen searchParams={searchParams} />
    </QueryClientProvider>,
  );

describe("TransactionsScreen", () => {
  beforeEach(() => {
    fetchTransactionsData.mockReset();
    resolveData([buildTransaction({ id: "aaaa1111" })]);
  });

  it("Firestoreから読んだ取引を一覧に出す", async () => {
    resolveData([
      buildTransaction({ id: "aaaa1111", content: "スーパー〇〇" }),
      buildTransaction({ id: "bbbb2222", content: "家賃引き落とし", categoryMajor: "住居費" }),
    ]);
    renderScreen();

    expect(await screen.findByRole("cell", { name: "スーパー〇〇" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "家賃引き落とし" })).toBeInTheDocument();
  });

  /**
   * 費目は大項目を主・中項目を従として1列に収める(B3)。
   * 費目名は絞り込みバーのセレクタにも並ぶので、一覧の中だけを見る
   */
  it("費目の列に大項目と中項目の両方を出す", async () => {
    resolveData([buildTransaction({ id: "aaaa1111" })]);
    renderScreen();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("食費")).toBeInTheDocument();
    expect(table.getByText("食料品")).toBeInTheDocument();
  });

  /** 空の中項目に「(未分類)」のような名前をアプリ側で与えない(同書6章) */
  it("中項目が空の取引は大項目だけを出す", async () => {
    resolveData([buildTransaction({ id: "aaaa1111", categoryMinor: "" })]);
    renderScreen();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("食費")).toBeInTheDocument();
    expect(table.queryByText("食料品")).not.toBeInTheDocument();
    expect(table.queryByText("(未分類)")).not.toBeInTheDocument();
  });

  it("選択中の期間で取得する", async () => {
    renderScreen({ period: "3m" });

    await screen.findByRole("cell", { name: "スーパー〇〇" });
    expect(fetchTransactionsData).toHaveBeenCalledWith("3m", expect.any(Date));
  });

  it("不正な期間は既定の直近1ヶ月に落として取得する", async () => {
    renderScreen({ period: "10y" });

    await screen.findByRole("cell", { name: "スーパー〇〇" });
    expect(fetchTransactionsData).toHaveBeenCalledWith("1m", expect.any(Date));
  });

  it("URLの絞り込み条件を一覧に反映する", async () => {
    resolveData([
      buildTransaction({ id: "aaaa1111", content: "スーパー〇〇", categoryMajor: "食費" }),
      buildTransaction({ id: "bbbb2222", content: "家賃引き落とし", categoryMajor: "住居費" }),
    ]);
    renderScreen({ category: "住居費" });

    expect(await screen.findByRole("cell", { name: "家賃引き落とし" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "スーパー〇〇" })).not.toBeInTheDocument();
  });

  it("URLの中項目でも絞り込む", async () => {
    resolveData([
      buildTransaction({ id: "aaaa1111", content: "スーパー〇〇", categoryMinor: "食料品" }),
      buildTransaction({ id: "bbbb2222", content: "定食屋〇〇", categoryMinor: "外食" }),
    ]);
    renderScreen({ subcategory: "外食" });

    expect(await screen.findByRole("cell", { name: "定食屋〇〇" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "スーパー〇〇" })).not.toBeInTheDocument();
  });

  /**
   * 印が無いと、一覧の金額を足してもB1の収支サマリと合わない理由が分からない。
   * 振替と計算対象外は意味が違うので別の印にする(同書5章)
   */
  it("振替・計算対象外の行にそれぞれ別の印を付ける", async () => {
    resolveData([
      buildTransaction({ id: "aaaa1111", content: "証券口座へ入金", isTransfer: true }),
      buildTransaction({ id: "bbbb2222", content: "立替分", isCalculationTarget: false }),
      buildTransaction({ id: "cccc3333", content: "スーパー〇〇" }),
    ]);
    renderScreen();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("振替")).toBeInTheDocument();
    expect(table.getByText("計算対象外")).toBeInTheDocument();
    // 集計に入る行には印を付けない
    expect(table.getAllByText(/振替|計算対象外/u)).toHaveLength(2);
  });

  it("振替かつ計算対象外の行には両方の印を出す", async () => {
    resolveData([
      buildTransaction({
        id: "aaaa1111",
        content: "証券口座へ入金",
        isTransfer: true,
        isCalculationTarget: false,
      }),
    ]);
    renderScreen();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("振替")).toBeInTheDocument();
    expect(table.getByText("計算対象外")).toBeInTheDocument();
  });

  /**
   * 期間を切り替えると選択肢の集合が変わる。黙って外すと、0件なのは「本当に無い」からなのか
   * 「選択が外れた」からなのかを画面から区別できない(B3)
   */
  it("選択中の費目がその期間に無くても選択肢に残し、該当が無いことを添える", async () => {
    resolveData([buildTransaction({ id: "aaaa1111", categoryMajor: "食費" })]);
    renderScreen({ category: "交通費" });

    expect(await screen.findByLabelText("費目(大項目)")).toHaveTextContent(
      "交通費(この期間に該当なし)",
    );
    // 絞り込みは効いたままなので一覧は0件になる
    expect(screen.queryByRole("cell", { name: "スーパー〇〇" })).not.toBeInTheDocument();
  });

  /**
   * 黙って古い側が欠けると、一覧に無いことを「取り込んでいない」と読み違える
   * (docs/transaction-import-requirements.md 8章)
   */
  it("読み取りが打ち切られたことを画面に出す", async () => {
    resolveData([buildTransaction({ id: "aaaa1111" })], true);
    renderScreen();

    expect(
      await screen.findByText(
        new RegExp(
          `${TRANSACTION_SCAN_LIMIT.toLocaleString("ja-JP")}件だけを読み込んでいます`,
          "u",
        ),
      ),
    ).toBeInTheDocument();
  });

  /**
   * 打ち切りは選択中の期間で読み取った件数に対する判定で、費目・口座・キーワードの
   * 絞り込みには依存しない。案内が絞り込み後の件数の話に読めると、表示中の件数と
   * 噛み合わないように見えて案内そのものを疑わせる
   */
  it("打ち切りの案内は、絞り込み後ではなく選択中の期間の件数を指していると分かる形で出す", async () => {
    resolveData([buildTransaction({ id: "aaaa1111" })], true);
    renderScreen({ category: "食費" });

    const notice = await screen.findByText(/件だけを読み込んでいます/u);
    expect(notice).toHaveTextContent("選択中の期間は取引が多いため");
    expect(notice).toHaveTextContent("絞り込みもこの範囲に対して行われます");
  });

  it("打ち切られていなければ案内を出さない", async () => {
    renderScreen();

    await screen.findByRole("cell", { name: "スーパー〇〇" });
    expect(screen.queryByText(/件だけを読み込んでいます/u)).not.toBeInTheDocument();
  });

  it("全期間で1件も無ければ「まだありません」を出し、一覧そのものを出さない", async () => {
    resolveData([]);
    renderScreen({ period: "all" });

    expect(await screen.findByText(/入出金明細のデータがまだありません/u)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    // B2への導線。絞り込みバーにも同じリンクがあるので件数では見ない
    expect(screen.getAllByRole("link", { name: "CSVを取り込む" }).length).toBeGreaterThan(0);
  });

  /**
   * 読むのは選択中の期間だけなので、他の期間に取引があるかどうかをこの画面は知らない。
   * 既定が「直近1ヶ月」である以上、しばらく取り込んでいないだけで「まだありません」と
   * 出すと、取り込み済みのデータを「無い」と伝えることになる
   */
  it("選択中の期間だけが空のときは、取り込み済みかもしれないことを伏せない", async () => {
    resolveData([]);
    renderScreen({ period: "1m" });

    expect(await screen.findByText(/選択した期間に取引がありません/u)).toBeInTheDocument();
    expect(screen.queryByText(/データがまだありません/u)).not.toBeInTheDocument();
  });

  /** 取得の失敗を空状態(未取込)として見せない。次にすべきことが正反対になる */
  it("取得に失敗したら理由を出し、空状態にはしない", async () => {
    fetchTransactionsData.mockResolvedValue({ ok: false, reason: "signed-out" });
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent("ログイン状態が切れています");
    expect(screen.queryByText(/入出金明細のデータがまだありません/u)).not.toBeInTheDocument();
  });
});
