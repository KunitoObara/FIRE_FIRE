import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MonthPicker } from "@/components/dashboard/MonthPicker";

const onSelect = vi.fn<(month: string) => void>();

const renderPicker = (props: Partial<MonthPickerProps> = {}): void => {
  render(
    <MonthPicker
      month="2026-08"
      maxMonth="2026-08"
      label="対象の年月"
      onSelect={onSelect}
      {...props}
    />,
  );
};

/** ポップオーバーを開いて月グリッドを出す */
const openPicker = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole("button", { name: /対象の年月/ }));
};

/**
 * 収支サマリの年月ピッカー(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 *
 * 中身は月のグリッドで、日は選ばせない。shadcnの`calendar`(react-day-picker)は日単位の
 * 選択しか持たず、日を選ばせてその月に丸めると選んだ日が結果に効かない操作になるため。
 */
describe("MonthPicker", () => {
  beforeEach(() => {
    onSelect.mockReset();
  });

  it("選択中の年月をボタンに出す", () => {
    renderPicker({ month: "2025-03" });

    expect(screen.getByRole("button", { name: /対象の年月/ })).toHaveTextContent("2025年3月");
  });

  it("開くと1〜12月が並び、選択中の月が押された状態になる", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-05", maxMonth: "2026-12" });

    await openPicker(user);

    expect(screen.getByRole("button", { name: "1月" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12月" })).toBeInTheDocument();
    // 色だけでなく属性でも選択状態を表す
    expect(screen.getByRole("button", { name: "5月" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "4月" })).toHaveAttribute("aria-pressed", "false");
  });

  it("月を押すと`yyyy-MM`で返し、ポップオーバーを閉じる", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-08", maxMonth: "2026-08" });

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: "3月" }));

    expect(onSelect).toHaveBeenCalledWith("2026-03");
    // 開いたまま残ると、選んだ結果(カードの数字)が隠れる
    expect(screen.queryByRole("button", { name: "3月" })).not.toBeInTheDocument();
  });

  /**
   * 未来の月には数える取引が無く、URLで直接指定されても当月に丸める(`resolveMonthId`)。
   * ここで選ばせると、押した先で当月に戻る操作を残すことになる
   */
  it("上限より後の月は選べない", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-08", maxMonth: "2026-08" });

    await openPicker(user);

    expect(screen.getByRole("button", { name: "8月" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "9月" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "12月" })).toBeDisabled();
  });

  it("上限の年を表示中は次の年へ進めない", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-08", maxMonth: "2026-08" });

    await openPicker(user);

    expect(screen.getByRole("button", { name: "次の年" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前の年" })).toBeEnabled();
  });

  /** 下限は設けない(取り込んである最も古い月をこの画面は知らない) */
  it("前の年へは何年でも遡れ、その年の12月まで選べる", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-08", maxMonth: "2026-08" });

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: "前の年" }));

    expect(screen.getByText("2025年")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12月" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次の年" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "12月" }));

    expect(onSelect).toHaveBeenCalledWith("2025-12");
  });

  /**
   * 年を送ったまま閉じた状態を覚えていると、次に開いたときに選択中の月がグリッドに無く、
   * 「いまどの月を見ているか」と表示がずれる
   */
  it("開き直すと選択中の月の年に戻る", async () => {
    const user = userEvent.setup();
    renderPicker({ month: "2026-08", maxMonth: "2026-08" });

    await openPicker(user);
    await user.click(screen.getByRole("button", { name: "前の年" }));

    expect(screen.getByText("2025年")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await openPicker(user);

    expect(screen.getByText("2026年")).toBeInTheDocument();
  });

  /**
   * B7取得年月・B11発生年月は任意入力で、空文字を「未設定」として渡す
   * (Y-01分割計画2本目「MonthPickerに『未設定に戻す』を追加」)。
   */
  describe("未設定(空文字)を扱う呼び出し側", () => {
    it("未設定のときはボタンに「未設定」と出す", () => {
      renderPicker({ month: "", maxMonth: "2026-08" });

      expect(screen.getByRole("button", { name: /対象の年月/ })).toHaveTextContent("未設定");
    });

    it("未設定のまま開くと、maxMonthの年を表示する", async () => {
      const user = userEvent.setup();
      renderPicker({ month: "", maxMonth: "2025-03" });

      await openPicker(user);

      expect(screen.getByText("2025年")).toBeInTheDocument();
    });

    it("clearableでないときは「未設定に戻す」を出さない", async () => {
      const user = userEvent.setup();
      renderPicker({ month: "2026-08", maxMonth: "2026-08" });

      await openPicker(user);

      expect(screen.queryByRole("button", { name: "未設定に戻す" })).not.toBeInTheDocument();
    });

    it("clearableのとき「未設定に戻す」を押すと空文字で返し、ポップオーバーを閉じる", async () => {
      const user = userEvent.setup();
      renderPicker({ month: "2026-08", maxMonth: "2026-08", clearable: true });

      await openPicker(user);
      await user.click(screen.getByRole("button", { name: "未設定に戻す" }));

      expect(onSelect).toHaveBeenCalledWith("");
      expect(screen.queryByRole("button", { name: "未設定に戻す" })).not.toBeInTheDocument();
    });

    /** 既に未設定のときに押しても意味の無い操作なので、押せなくする */
    it("clearableでも、すでに未設定なら「未設定に戻す」は押せない", async () => {
      const user = userEvent.setup();
      renderPicker({ month: "", maxMonth: "2026-08", clearable: true });

      await openPicker(user);

      expect(screen.getByRole("button", { name: "未設定に戻す" })).toBeDisabled();
    });
  });

  /**
   * `Controller`経由で使う呼び出し側(B7・B11)が`field.onBlur`を渡す。react-hook-formの
   * `mode: "onTouched"`はこれが呼ばれて初めて「touched」を付けるため、渡された`onBlur`が
   * トリガーボタンのblurで実際に呼ばれることを確かめる(B9リスクレベルSelectと同じ組み方)。
   */
  it("トリガーボタンからフォーカスが外れると、渡されたonBlurを呼ぶ", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    renderPicker({ onBlur });

    // 開くとRadixのポップオーバーが中身へフォーカスを移すため、トリガー自体がblurする
    await openPicker(user);

    expect(onBlur).toHaveBeenCalled();
  });
});
