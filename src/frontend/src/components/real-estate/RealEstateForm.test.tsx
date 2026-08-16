import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RealEstateForm } from "@/components/real-estate/RealEstateForm";
import { REAL_ESTATE_FORM_INITIAL_VALUES } from "@/constants/real-estate";

import type { RenderResult } from "@testing-library/react";

const onSubmit = vi.fn();

/** 新規登録モード(空のフォーム)を描画する */
const renderCreateForm = (): RenderResult =>
  render(
    <RealEstateForm
      mode="create"
      initialValues={REAL_ESTATE_FORM_INITIAL_VALUES}
      cancelHref="/real-estate"
      onSubmit={onSubmit}
    />,
  );

describe("RealEstateForm", () => {
  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue({ ok: true, id: "created-id" });
  });

  it("必須項目を入力して保存すると、入力内容を数値にして渡す", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "〇〇マンション101号室");
    await user.type(screen.getByLabelText("所在地(任意)"), "東京都渋谷区神南1-2-3");
    await user.type(screen.getByLabelText("時価(円)"), "32000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "18400000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: "〇〇マンション101号室",
        location: "東京都渋谷区神南1-2-3",
        // 取得年月は任意入力。入れずに保存すれば`null`が渡る(B7)
        acquiredOn: null,
        marketValue: 32_000_000,
        loanBalance: 18_400_000,
        rental: null,
      });
    });
  });

  /**
   * 取得年月は任意入力で、入れると資産推移グラフがその月から物件を積み始める
   * (docs/screen-requirements-real-estate.md B7)。
   */
  it("取得年月を入力して保存すると、そのまま渡す", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "□□戸建て");
    await user.type(screen.getByLabelText("取得年月(任意)"), "2019-04");
    await user.type(screen.getByLabelText("時価(円)"), "18000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "0");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ acquiredOn: "2019-04" }));
    });
  });

  /** まだ取得していない物件を過去のグラフに積まないため、当月より後は弾く */
  it("取得年月に未来の年月を入れると保存しない", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "□□戸建て");
    await user.type(screen.getByLabelText("取得年月(任意)"), "2099-12");
    await user.type(screen.getByLabelText("時価(円)"), "18000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "0");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("取得年月に未来の年月は入力できません。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("所在地は未入力でも保存できる", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "□□戸建て");
    await user.type(screen.getByLabelText("時価(円)"), "18000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "0");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ location: "" }));
    });
  });

  it("物件名・時価・ローン残高が未入力ならインラインエラーを出し、保存しない", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("物件名を入力してください。")).toBeInTheDocument();
    expect(screen.getByText("時価(円)を入力してください。")).toBeInTheDocument();
    expect(screen.getByText("ローン残高(円)を入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** HTMLモック(b7-real-estate-edit.html)の「18,400,000」のケース */
  it("金額にカンマが入っているとエラーを出し、保存しない", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "〇〇マンション101号室");
    await user.type(screen.getByLabelText("時価(円)"), "32000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "18,400,000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("半角数字のみ入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("金額が12桁を超えるとエラーを出し、保存しない", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "〇〇マンション101号室");
    await user.type(screen.getByLabelText("時価(円)"), "1000000000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "0");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("金額は12桁以内で入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("「収益物件として登録」をオンにしたときだけ賃貸の入力欄を出し、必須にする", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.queryByLabelText("賃貸収入(月額・円)")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("物件名"), "〇〇マンション101号室");
    await user.type(screen.getByLabelText("時価(円)"), "32000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "18400000");
    await user.click(screen.getByLabelText(/収益物件として登録/u));

    expect(screen.getByLabelText("賃貸収入(月額・円)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("賃貸収入(月額・円)を入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("賃貸収入(月額・円)"), "128000");
    await user.type(screen.getByLabelText("賃貸支出(月額・円)"), "22000");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rental: { monthlyIncome: 128_000, monthlyExpense: 22_000 } }),
      );
    });
  });

  /**
   * 収益物件として登録済みの物件のチェックを外して保存した場合、賃貸収入/支出は保持しない
   * (docs/screen-requirements-real-estate.md B7)。入力欄に値が残っていても保存されない。
   */
  it("収益物件のチェックを外して保存すると、賃貸収入/支出を保存しない", async () => {
    const user = userEvent.setup();
    render(
      <RealEstateForm
        mode="edit"
        initialValues={{
          name: "〇〇マンション101号室",
          location: "東京都渋谷区神南1-2-3",
          acquiredOn: "2019-04",
          marketValue: "32000000",
          loanBalance: "18400000",
          isRentalProperty: true,
          rentalMonthlyIncome: "128000",
          rentalMonthlyExpense: "22000",
        }}
        cancelHref="/real-estate/shibuya-101"
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByLabelText(/収益物件として登録/u));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ rental: null }));
    });
  });

  it("編集モードでは既存の登録値がプリセットされる", () => {
    render(
      <RealEstateForm
        mode="edit"
        initialValues={{
          name: "〇〇マンション101号室",
          location: "東京都渋谷区神南1-2-3",
          acquiredOn: "2019-04",
          marketValue: "32000000",
          loanBalance: "18400000",
          isRentalProperty: true,
          rentalMonthlyIncome: "128000",
          rentalMonthlyExpense: "22000",
        }}
        cancelHref="/real-estate/shibuya-101"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("物件名")).toHaveValue("〇〇マンション101号室");
    expect(screen.getByLabelText("時価(円)")).toHaveValue("32000000");
    expect(screen.getByLabelText(/収益物件として登録/u)).toBeChecked();
    expect(screen.getByLabelText("賃貸収入(月額・円)")).toHaveValue("128000");
  });

  it("キャンセルは遷移元に戻るリンクになっている", () => {
    renderCreateForm();

    expect(screen.getByRole("link", { name: "キャンセル" })).toHaveAttribute(
      "href",
      "/real-estate",
    );
  });

  it("保存に失敗したら理由を表示し、遷移しない", async () => {
    const user = userEvent.setup();
    onSubmit.mockResolvedValue({ ok: false, reason: "permission-denied" });
    renderCreateForm();

    await user.type(screen.getByLabelText("物件名"), "□□戸建て");
    await user.type(screen.getByLabelText("時価(円)"), "18000000");
    await user.type(screen.getByLabelText("ローン残高(円)"), "0");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この操作は許可されていません。ログインし直すか、画面を更新してください。",
    );
    // 失敗後は再度保存できる状態に戻す
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });
});
