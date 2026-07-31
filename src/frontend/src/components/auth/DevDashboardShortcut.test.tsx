import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevDashboardShortcut } from "@/components/auth/DevDashboardShortcut";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DevDashboardShortcut", () => {
  it("迂回が無効なときは何も表示しない", () => {
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", undefined);
    const { container } = render(<DevDashboardShortcut />);

    expect(container).toBeEmptyDOMElement();
  });

  it("迂回が有効なときだけダッシュボードへの導線を出す", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");
    render(<DevDashboardShortcut />);

    expect(
      screen.getByRole("link", { name: "開発用: ログインせずダッシュボードへ" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("本番ビルドでは環境変数がtrueでも表示しない", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD", "true");
    const { container } = render(<DevDashboardShortcut />);

    expect(container).toBeEmptyDOMElement();
  });
});
