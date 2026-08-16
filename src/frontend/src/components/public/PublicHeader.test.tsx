import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublicHeader } from "@/components/public/PublicHeader";

vi.mock("@/components/public/PublicAuthActions", () => ({
  // 導線の出し分けはPublicAuthActions側でテストする。ここではヘッダーが置く位置だけを見る
  PublicAuthActions: () => <span>導線</span>,
}));

describe("PublicHeader(docs/screen-requirements-public.md 2章)", () => {
  it("ロゴからA0へ戻れる", () => {
    render(<PublicHeader />);

    expect(screen.getByRole("link", { name: "FIRE-FIRE" })).toHaveAttribute("href", "/");
  });

  it("導線をヘッダーに置く", () => {
    render(<PublicHeader />);

    expect(screen.getByRole("navigation", { name: "ヘッダーの導線" })).toHaveTextContent("導線");
  });
});
