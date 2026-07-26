import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NavigationProbe } from "@/components/NavigationProbe";

vi.mock("next/navigation", () => ({
  usePathname: () => "/spa-check",
}));

describe("NavigationProbe", () => {
  it("現在のパスを表示する", () => {
    render(<NavigationProbe />);

    expect(screen.getByText("現在のパス")).toBeInTheDocument();
    expect(screen.getByText("/spa-check")).toBeInTheDocument();
  });

  it("ボタン操作でカウンタが増える", async () => {
    const user = userEvent.setup();
    render(<NavigationProbe />);

    const counter = screen.getByText("カウンタ").nextElementSibling;
    expect(counter).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: "カウンタを +1" }));

    expect(counter).toHaveTextContent("1");
  });
});
