import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RealEstateDetail } from "@/components/real-estate/RealEstateDetail";

/** 収益物件。利ざや・賃貸収支ともプラス */
const rentalProperty: RealEstateProperty = {
  id: "shibuya-101",
  name: "〇〇マンション101号室",
  location: "東京都渋谷区神南1-2-3",
  acquiredOn: null,
  marketValue: 32_000_000,
  loanBalance: 18_400_000,
  rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 },
  updatedAt: "2026-06-01",
  valueHistory: {},
};

/** 非収益物件。ローン完済済み */
const ownHomeProperty: RealEstateProperty = {
  id: "chiba-house",
  name: "□□戸建て",
  location: "千葉県市川市八幡7-8-9",
  acquiredOn: null,
  marketValue: 18_000_000,
  loanBalance: 0,
  updatedAt: "2026-04-02",
  valueHistory: {},
};

describe("RealEstateDetail", () => {
  it("時価・ローン残高と、自動計算した利ざやを表示する", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByText("¥ 32,000,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 18,400,000")).toBeInTheDocument();
    // 32,000,000 - 18,400,000
    expect(screen.getByText("¥ 13,600,000")).toBeInTheDocument();
  });

  it("オーバーローンの物件では利ざやをマイナス表記にする", () => {
    render(
      <RealEstateDetail
        property={{ ...ownHomeProperty, marketValue: 12_800_000, loanBalance: 14_100_000 }}
      />,
    );

    expect(screen.getByText("- ¥ 1,300,000")).toBeInTheDocument();
  });

  it("収益物件では賃貸収入・賃貸支出と収支を表示する", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByText("賃貸収支(月額)")).toBeInTheDocument();
    expect(screen.getByText("¥ 128,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 22,000")).toBeInTheDocument();
    expect(screen.getByText("+ ¥ 106,000")).toBeInTheDocument();
  });

  it("収益物件でない物件には賃貸収支を表示しない", () => {
    render(<RealEstateDetail property={ownHomeProperty} />);

    expect(screen.queryByText("賃貸収支(月額)")).not.toBeInTheDocument();
    expect(screen.queryByText("賃貸収入")).not.toBeInTheDocument();
  });

  it("物件基本情報として物件名・所在地・最終更新日を表示する", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByRole("heading", { name: "〇〇マンション101号室" })).toBeInTheDocument();
    // 見出しの下は簡略表記、物件基本情報には登録された住所をそのまま出す
    expect(screen.getByText("東京都渋谷区・収益物件")).toBeInTheDocument();
    expect(screen.getByText("東京都渋谷区神南1-2-3")).toBeInTheDocument();
    expect(screen.getByText("2026/06/01")).toBeInTheDocument();
  });

  /**
   * 取得年月は資産推移グラフが物件を積み始める起点(B1「不動産を含む分類軸の集計」)。
   * 入力欄はB7にしか無いので、値が入っているかを参照側でも確かめられるようにする。
   */
  it("取得年月を年月の表記で表示する", () => {
    render(<RealEstateDetail property={{ ...rentalProperty, acquiredOn: "2019-04" }} />);

    expect(screen.getByText("2019年4月")).toBeInTheDocument();
  });

  /**
   * 未入力でも行ごと消さない。項目名と値が対になるリストでは、行が無いと項目そのものが
   * 存在しないように見えるため。
   */
  it("取得年月が未登録の物件では「未登録」と表示する", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByText("取得年月")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
  });

  /** 所在地はB7で任意入力(未入力可)なので、空でも区切りの「・」だけが残らないようにする */
  it("所在地が未登録の収益物件では、見出しの下に区切りなしで収益物件とだけ出す", () => {
    render(<RealEstateDetail property={{ ...rentalProperty, location: "" }} />);

    expect(screen.getByText("収益物件")).toBeInTheDocument();
    expect(screen.queryByText("・収益物件")).not.toBeInTheDocument();
  });

  it("「編集」ボタンからB7 編集モードへ遷移できる", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute(
      "href",
      "/real-estate/shibuya-101/edit",
    );
  });

  it("「一覧に戻る」リンクからB5 不動産一覧画面へ遷移できる", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.getByRole("link", { name: "一覧に戻る" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
  });

  it("参照専用の画面なので入力欄を持たない", () => {
    render(<RealEstateDetail property={rentalProperty} />);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
