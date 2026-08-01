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
const accounts = ["楽天カード", "現金"];

const baseFilters: TransactionFilters = {
  periodId: "1m",
  category: "",
  account: "",
  keyword: "",
  sortKey: "date",
  sortDirection: "desc",
  page: 1,
};

const renderFilterBar = (
  props: Partial<TransactionsFilterBarProps> = {},
): ReturnType<typeof render> =>
  render(
    <TransactionsFilterBar
      categories={categories}
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
    expect(screen.getByLabelText("費目")).toHaveTextContent("食費");
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

    await user.type(screen.getByLabelText("キーワード検索"), "イオン");
    await user.click(screen.getByRole("button", { name: "絞り込む" }));

    expect(push).toHaveBeenCalledWith(
      "/transactions?period=3m&q=%E3%82%A4%E3%82%AA%E3%83%B3&sort=date&dir=desc",
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
        accounts={accounts}
        filters={firstFilters}
      />,
    );

    expect(screen.getByLabelText("費目")).toHaveTextContent("食費");

    const nextFilters: TransactionFilters = { ...baseFilters, category: "住居費" };
    rerender(
      <TransactionsFilterBar
        key={buildTransactionsFilterBarKey(nextFilters)}
        categories={categories}
        accounts={accounts}
        filters={nextFilters}
      />,
    );

    expect(screen.getByLabelText("費目")).toHaveTextContent("住居費");
  });
});
