import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicFooter } from "@/components/public/PublicFooter";

describe("PublicFooter(docs/screen-requirements-public.md A0)", () => {
  it("利用規約とプライバシーポリシーへのリンクを出す", () => {
    render(<PublicFooter />);

    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("コピーライトを出す", () => {
    render(<PublicFooter />);

    expect(screen.getByText("© 2026 FIRE-FIRE")).toBeInTheDocument();
  });

  /**
   * A0へ戻るのはヘッダーのロゴからで、フッターには置かない
   * (docs/screen-list-and-transitions.md 3.4)。ヘルプ(X2)も未着手のため枠を置かない。
   */
  it("規約2本以外のリンクを置かない", () => {
    render(<PublicFooter />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
