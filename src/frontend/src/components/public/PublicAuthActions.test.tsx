import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicAuthActions } from "@/components/public/PublicAuthActions";

const subscribeToPublicSessionState =
  vi.fn<(onChange: (state: PublicSessionState) => void) => () => void>();

vi.mock("@/lib/auth/public-session", () => ({
  subscribeToPublicSessionState: (onChange: (state: PublicSessionState) => void) =>
    subscribeToPublicSessionState(onChange),
}));

/** 判定結果を即座に通知する購読(実際のFirebaseも購読直後に一度発火する) */
const withSessionState = (state: PublicSessionState): void => {
  subscribeToPublicSessionState.mockImplementation((onChange) => {
    onChange(state);
    return () => {};
  });
};

describe("PublicAuthActions(docs/screen-requirements-public.md 2章)", () => {
  beforeEach(() => {
    subscribeToPublicSessionState.mockReset();
  });

  it("未ログインならログインとサインアップを出す", () => {
    withSessionState("signed-out");

    render(<PublicAuthActions />);

    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "サインアップ" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("link", { name: "ダッシュボードへ" })).not.toBeInTheDocument();
  });

  /** ログイン中に「サインアップ」を勧め続けない。差し替えるのは導線だけでリダイレクトはしない */
  it("ログイン中はダッシュボードへの1つに差し替える", () => {
    withSessionState("signed-in");

    render(<PublicAuthActions />);

    expect(screen.getByRole("link", { name: "ダッシュボードへ" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.queryByRole("link", { name: "ログイン" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "サインアップ" })).not.toBeInTheDocument();
  });

  /**
   * 先に未ログイン用を描いてから差し替えると、ログイン中のユーザーに一瞬「ログイン」ボタンが見える。
   */
  it("判定が確定するまではどちらの導線も描かない", () => {
    subscribeToPublicSessionState.mockReturnValue(() => {});

    render(<PublicAuthActions />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  /** 確定した瞬間に本文が跳ねないよう、中身が空の間も領域の高さを保つ */
  it("判定中も導線と同じ高さの領域を保つ", () => {
    subscribeToPublicSessionState.mockReturnValue(() => {});

    const { container } = render(<PublicAuthActions />);

    expect(container.firstElementChild).toHaveClass("h-7");
  });

  it("アンマウント時に購読を解除する", () => {
    const unsubscribe = vi.fn();
    subscribeToPublicSessionState.mockReturnValue(unsubscribe);

    render(<PublicAuthActions />).unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
