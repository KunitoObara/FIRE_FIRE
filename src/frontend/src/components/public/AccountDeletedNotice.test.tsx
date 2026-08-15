import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AccountDeletedNotice } from "@/components/public/AccountDeletedNotice";
import {
  clearAccountDeletedNotice,
  markAccountDeleted,
  wasAccountDeleted,
} from "@/lib/auth/account-deleted-notice";

/**
 * 削除の直後に1回だけ出す(docs/auth-login-requirements.md 3.11)。
 * 遷移先で何も出ないと、削除できたのか途中で失敗したのかが分からない。
 */
describe("AccountDeletedNotice", () => {
  beforeEach(() => {
    clearAccountDeletedNotice();
  });

  it("削除の直後は完了を伝える", () => {
    markAccountDeleted();

    render(<AccountDeletedNotice />);

    expect(screen.getByRole("status")).toHaveTextContent("アカウントとデータを削除しました。");
  });

  /** 許可リストの該当ドキュメントも消すため、同じアドレスでもそのままでは登録し直せない */
  it("再登録には招待が要ることまで伝える", () => {
    markAccountDeleted();

    render(<AccountDeletedNotice />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "再度ご利用になる場合は、あらためて招待をお受けください。",
    );
  });

  it("削除していなければ何も出さない", () => {
    render(<AccountDeletedNotice />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /** リロードや再訪問で出続けないよう、表示したら消費する */
  it("表示したらフラグを消費する", () => {
    markAccountDeleted();

    render(<AccountDeletedNotice />);

    expect(wasAccountDeleted()).toBe(false);
  });
});
