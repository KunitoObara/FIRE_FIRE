import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateDetail } from "@/components/real-estate/RealEstateDetail";

import type { RenderResult } from "@testing-library/react";

const onDelete = vi.fn();

/** 削除の導線はB6-1で足したもの。既存の表示のテストは分類軸を取得済み・該当なしで描く */
const renderDetail = (
  property: RealEstateProperty,
  affectedAxisNames: AffectedAxisNamesState = { status: "ready", axisNames: [] },
): RenderResult =>
  render(
    <RealEstateDetail
      property={property}
      affectedAxisNames={affectedAxisNames}
      onDelete={onDelete}
    />,
  );

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
    renderDetail(rentalProperty);

    expect(screen.getByText("¥ 32,000,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 18,400,000")).toBeInTheDocument();
    // 32,000,000 - 18,400,000
    expect(screen.getByText("¥ 13,600,000")).toBeInTheDocument();
  });

  it("オーバーローンの物件では利ざやをマイナス表記にする", () => {
    renderDetail({ ...ownHomeProperty, marketValue: 12_800_000, loanBalance: 14_100_000 });

    expect(screen.getByText("- ¥ 1,300,000")).toBeInTheDocument();
  });

  it("収益物件では賃貸収入・賃貸支出と収支を表示する", () => {
    renderDetail(rentalProperty);

    expect(screen.getByText("賃貸収支(月額)")).toBeInTheDocument();
    expect(screen.getByText("¥ 128,000")).toBeInTheDocument();
    expect(screen.getByText("¥ 22,000")).toBeInTheDocument();
    expect(screen.getByText("+ ¥ 106,000")).toBeInTheDocument();
  });

  it("収益物件でない物件には賃貸収支を表示しない", () => {
    renderDetail(ownHomeProperty);

    expect(screen.queryByText("賃貸収支(月額)")).not.toBeInTheDocument();
    expect(screen.queryByText("賃貸収入")).not.toBeInTheDocument();
  });

  it("物件基本情報として物件名・所在地・最終更新日を表示する", () => {
    renderDetail(rentalProperty);

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
    renderDetail({ ...rentalProperty, acquiredOn: "2019-04" });

    expect(screen.getByText("2019年4月")).toBeInTheDocument();
  });

  /**
   * 未入力でも行ごと消さない。項目名と値が対になるリストでは、行が無いと項目そのものが
   * 存在しないように見えるため。
   */
  it("取得年月が未登録の物件では「未登録」と表示する", () => {
    renderDetail(rentalProperty);

    expect(screen.getByText("取得年月")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
  });

  /** 所在地はB7で任意入力(未入力可)なので、空でも区切りの「・」だけが残らないようにする */
  it("所在地が未登録の収益物件では、見出しの下に区切りなしで収益物件とだけ出す", () => {
    renderDetail({ ...rentalProperty, location: "" });

    expect(screen.getByText("収益物件")).toBeInTheDocument();
    expect(screen.queryByText("・収益物件")).not.toBeInTheDocument();
  });

  it("「編集」ボタンからB7 編集モードへ遷移できる", () => {
    renderDetail(rentalProperty);

    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute(
      "href",
      "/real-estate/shibuya-101/edit",
    );
  });

  it("「一覧に戻る」リンクからB5 不動産一覧画面へ遷移できる", () => {
    renderDetail(rentalProperty);

    expect(screen.getByRole("link", { name: "一覧に戻る" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
  });

  it("参照専用の画面なので入力欄を持たない", () => {
    renderDetail(rentalProperty);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("RealEstateDetail(削除)", () => {
  beforeEach(() => {
    onDelete.mockReset();
    onDelete.mockResolvedValue({ ok: true });
  });

  /**
   * 削除は元に戻せないので必ず確認を挟む(DESIGN.md 6章)。どの物件を消すのか分かるよう
   * 物件名を出し、履歴が消えて資産推移グラフから過去に遡って額が消えることも伝える
   * (docs/screen-requirements-real-estate.md「物件の削除」)。
   */
  it("「削除」を押すと確認ダイアログを出し、押しただけでは削除しない", async () => {
    const user = userEvent.setup();
    renderDetail(rentalProperty);

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(await screen.findByText("「〇〇マンション101号室」を削除しますか?")).toBeInTheDocument();
    expect(screen.getByText(/この操作は取り消せません/u)).toBeInTheDocument();
    expect(screen.getByText(/過去に遡って消えます/u)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("確認ダイアログで実行すると削除する", async () => {
    const user = userEvent.setup();
    renderDetail(rentalProperty);

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * 物件は複数の分類軸から独立に選べるため、該当する軸は**すべて列挙する**(B11の負債削除と
   * 同じ)。件数だけを示すと、どの軸の集計が変わるかを確かめるためにB4を開き直させることになる。
   */
  it("この物件を集計対象にしている分類軸をすべて挙げる", async () => {
    const user = userEvent.setup();
    renderDetail(rentalProperty, {
      status: "ready",
      axisNames: ["総資産", "不動産込み"],
    });

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(
      await screen.findByText(/「総資産」「不動産込み」の集計も変わります/u),
    ).toBeInTheDocument();
  });

  /** 該当が無ければ分類軸の一文自体を出さない(空の但し書きを並べない) */
  it("集計対象にしている分類軸が無ければ、その一文を出さない", async () => {
    const user = userEvent.setup();
    renderDetail(rentalProperty);

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(await screen.findByText(/この操作は取り消せません/u)).toBeInTheDocument();
    expect(screen.queryByText(/集計も変わります/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/確認できていません/u)).not.toBeInTheDocument();
  });

  /**
   * 分類軸を取得できていないときも削除は止めない(分類軸は影響の説明であって、削除の可否を
   * 決めるものではない)。ただし黙って省くと「影響する軸が無い」と読めてしまうため、
   * 確かめられなかったこと自体を出す(PO判断)。
   */
  it("分類軸を取得できていないときは、確認できていない旨を出したうえで削除できる", async () => {
    const user = userEvent.setup();
    renderDetail(rentalProperty, { status: "unknown" });

    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(await screen.findByText(/確認できていません/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  /** 失敗したらダイアログに留まってエラーを出す(遷移しない) */
  it("削除に失敗したらダイアログを閉じずにエラーを出す", async () => {
    const user = userEvent.setup();
    onDelete.mockResolvedValue({ ok: false, reason: "unknown" });
    renderDetail(rentalProperty);

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/操作に失敗しました/u);
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
  });
});
