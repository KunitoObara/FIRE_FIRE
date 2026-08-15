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

    // `Button size="sm"` の実寸(`h-8`)と揃える。ずれると確定した瞬間に本文が跳ねる
    expect(container.querySelector(".min-h-8")).toBeInTheDocument();
  });

  /** A0のCTAはヘッダーより大きい。確保する高さもボタンの実寸に合わせる */
  it("size=lgでは大きい導線の高さで領域を保つ", () => {
    subscribeToPublicSessionState.mockReturnValue(() => {});

    const { container } = render(<PublicAuthActions size="lg" />);

    expect(container.querySelector(".min-h-11")).toBeInTheDocument();
  });

  /**
   * 登録の案内なので、ログイン中には出さない(A0のヒーローでのみ使う)。
   * docs/screen-requirements-public.md A0「サインアップボタンは置いたうえで招待制を添える」。
   */
  it("招待制の注記は未ログインのときだけ出す", () => {
    withSessionState("signed-out");

    render(<PublicAuthActions size="lg" withInviteOnlyNotice />);

    expect(
      screen.getByText("現在はベータ版のため、登録は招待制で運用しています。"),
    ).toBeInTheDocument();
  });

  it("ログイン中は招待制の注記を出さない", () => {
    withSessionState("signed-in");

    render(<PublicAuthActions size="lg" withInviteOnlyNotice />);

    expect(
      screen.queryByText("現在はベータ版のため、登録は招待制で運用しています。"),
    ).not.toBeInTheDocument();
  });

  /** 注記も判定確定で文字が入るため、入る前から1行分の高さを確保しておく */
  it("注記を出す設定なら、判定中も1行分の高さを確保する", () => {
    subscribeToPublicSessionState.mockReturnValue(() => {});

    const { container } = render(<PublicAuthActions size="lg" withInviteOnlyNotice />);

    expect(container.querySelector("p.min-h-4")).toBeInTheDocument();
  });

  it("注記を出さない設定なら領域ごと置かない", () => {
    withSessionState("signed-out");

    const { container } = render(<PublicAuthActions size="lg" />);

    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("アンマウント時に購読を解除する", () => {
    const unsubscribe = vi.fn();
    subscribeToPublicSessionState.mockReturnValue(unsubscribe);

    render(<PublicAuthActions />).unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
