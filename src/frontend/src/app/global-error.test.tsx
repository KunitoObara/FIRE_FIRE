import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/global-error";

/**
 * ルートレイアウトごと壊れたときの受け皿([X3])。
 *
 * ここが黙って落ちると、クライアント側の描画エラーがSentryに一切届かない
 * — Sentryを入れた目的がこの経路に対してだけ達成できなくなる。
 */

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ captureException }));

/*
  `global-error.tsx`は`<html>`と`<body>`を自前で返す(ルートレイアウトを
  置き換えるため)。jsdomの既定のコンテナへそのまま挿すと入れ子になるので、
  document自体を器にする。
*/
const renderGlobalError = (error: Error, reset = vi.fn()) =>
  render(<GlobalError error={error} reset={reset} />, {
    container: document,
    baseElement: document,
  });

describe("GlobalError", () => {
  it("受け取った例外をSentryへ送る", () => {
    const error = new Error("描画に失敗しました");

    renderGlobalError(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("利用者向けの文言と再読み込みの導線を出す", () => {
    renderGlobalError(new Error("boom"));

    expect(screen.getByRole("heading", { name: "エラーが発生しました" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });
});
