import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { buildTransactionsFilterBarKey } from "@/lib/transactions/filters";

const push = vi.fn<(href: string) => void>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const categories = ["食費", "住居費"];
const categoryMinorsByMajor: Record<string, string[]> = {
  食費: ["外食", "食料品"],
  住居費: ["家賃"],
};
const accounts = ["〇〇カード", "現金"];

const baseFilters: TransactionFilters = {
  periodId: "1m",
  category: "",
  categoryMinor: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
  pageSize: 20,
};

const renderFilterBar = (
  props: Partial<TransactionsFilterBarProps> = {},
): ReturnType<typeof render> =>
  render(
    <TransactionsFilterBar
      categories={categories}
      categoryMinorsByMajor={categoryMinorsByMajor}
      accounts={accounts}
      filters={baseFilters}
      {...props}
    />,
  );

describe("TransactionsFilterBar", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("filtersの初期値をフォームに表示する", () => {
    renderFilterBar({ filters: { ...baseFilters, category: "食費" } });

    expect(screen.getByLabelText("期間")).toHaveTextContent("直近1ヶ月");
    expect(screen.getByLabelText("費目(大項目)")).toHaveTextContent("食費");
  });

  /**
   * 期間を切り替えると選択肢の集合が変わる。黙って外すと、結果が0件なのは「本当に無い」
   * からなのか「選択が外れた」からなのかを画面から区別できない
   * (docs/screen-requirements-dashboard.md B3)
   */
  it("選択中の費目がその期間に無ければ、該当なしと添えて選択肢に残す", () => {
    renderFilterBar({ filters: { ...baseFilters, category: "交通費" } });

    expect(screen.getByLabelText("費目(大項目)")).toHaveTextContent("交通費(この期間に該当なし)");
  });

  it("選択中の中項目がその期間に無い場合も同じように残す", () => {
    renderFilterBar({ filters: { ...baseFilters, categoryMinor: "タクシー" } });

    expect(screen.getByLabelText("費目(中項目)")).toHaveTextContent("タクシー(この期間に該当なし)");
  });

  /** 大項目を選ぶと中項目セレクタの選択肢がその配下に絞られる(同書6章) */
  it("大項目を選ぶと中項目の選択肢がその配下に絞られる", async () => {
    const user = userEvent.setup();
    renderFilterBar({ filters: { ...baseFilters, category: "住居費" } });

    await user.click(screen.getByLabelText("費目(中項目)"));

    expect(await screen.findByRole("option", { name: "家賃" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "外食" })).not.toBeInTheDocument();
  });

  it("大項目が未選択なら全ての中項目を並べる", async () => {
    const user = userEvent.setup();
    renderFilterBar();

    await user.click(screen.getByLabelText("費目(中項目)"));

    expect(await screen.findByRole("option", { name: "家賃" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "外食" })).toBeInTheDocument();
  });

  /**
   * 中項目の選択肢は大項目の配下に絞られるので、残したままだと選択肢に無い中項目が
   * 選ばれた状態になり、送信すれば必ず0件になる
   */
  it("大項目を変えると中項目は「すべて」に戻る", async () => {
    const user = userEvent.setup();
    renderFilterBar({ filters: { ...baseFilters, category: "食費", categoryMinor: "外食" } });

    await user.click(screen.getByLabelText("費目(大項目)"));
    await user.click(await screen.findByRole("option", { name: "住居費" }));

    expect(screen.getByLabelText("費目(中項目)")).toHaveTextContent("すべて");
  });

  it("中項目を選んで絞り込むとURLに反映する", async () => {
    const user = userEvent.setup();
    renderFilterBar({ filters: { ...baseFilters, category: "食費" } });

    await user.click(screen.getByLabelText("費目(中項目)"));
    await user.click(await screen.findByRole("option", { name: "外食" }));
    await user.click(screen.getByRole("button", { name: "絞り込む" }));

    expect(push).toHaveBeenCalledWith(
      `/transactions?period=1m&category=${encodeURIComponent("食費")}&subcategory=${encodeURIComponent("外食")}&sort=date&dir=desc`,
    );
  });

  it("「CSVを取り込む」からB2へ遷移できる", () => {
    renderFilterBar();

    expect(screen.getByRole("link", { name: "CSVを取り込む" })).toHaveAttribute(
      "href",
      "/csv-import",
    );
  });

  it("キーワードを入力して絞り込むと、他の条件を保ったままURLへ反映しページを1に戻す", async () => {
    const user = userEvent.setup();
    renderFilterBar({ filters: { ...baseFilters, periodId: "3m", page: 3 } });

    await user.type(screen.getByLabelText("キーワード検索"), "スーパー");
    await user.click(screen.getByRole("button", { name: "絞り込む" }));

    expect(push).toHaveBeenCalledWith(
      `/transactions?period=3m&q=${encodeURIComponent("スーパー")}&sort=date&dir=desc`,
    );
  });

  /**
   * バグ回帰テスト: 「絞り込む」以外の経路(ブラウザの戻る/進む等)でfiltersが変わった場合、
   * 編集中のドラフト値もURLの内容に追従しなければならない。このコンポーネント自身は
   * `useState(filters.xxx)`を初期値としてしか使わないため、呼び出し側が`key`に
   * `buildTransactionsFilterBarKey`の値を渡してコンポーネントごと再マウントさせる必要がある
   * (`page.tsx`の実装と同じ組み立て方をここでも再現して検証する)。
   */
  it("filtersの絞り込み条件が変わりkeyが変わると、フォームの表示も追従する", () => {
    const firstFilters: TransactionFilters = { ...baseFilters, category: "食費" };
    const { rerender } = render(
      <TransactionsFilterBar
        key={buildTransactionsFilterBarKey(firstFilters)}
        categories={categories}
        categoryMinorsByMajor={categoryMinorsByMajor}
        accounts={accounts}
        filters={firstFilters}
      />,
    );

    expect(screen.getByLabelText("費目(大項目)")).toHaveTextContent("食費");

    const nextFilters: TransactionFilters = { ...baseFilters, category: "住居費" };
    rerender(
      <TransactionsFilterBar
        key={buildTransactionsFilterBarKey(nextFilters)}
        categories={categories}
        categoryMinorsByMajor={categoryMinorsByMajor}
        accounts={accounts}
        filters={nextFilters}
      />,
    );

    expect(screen.getByLabelText("費目(大項目)")).toHaveTextContent("住居費");
  });
});
