import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readPrefersReducedMotion, usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * `matchMedia`を差し替える。戻り値の`listeners`で、あとから設定が変わった場合を再現できる。
 *
 * jsdomは`matchMedia`を実装しておらず、テスト全体のセットアップ(`vitest.setup.ts`)が
 * 常に`matches: false`を返すスタブを入れている。ここではその上からケースごとに差し替える。
 */
const stubMatchMedia = (matches: boolean): { change: (next: boolean) => void } => {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );

  return {
    change: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
};

/**
 * 判定が**最初の描画の時点で**確定していることを、hookの初期値に使う関数を直に呼んで確かめる。
 *
 * hookの戻り値では確かめられない。React Testing Libraryの`render`はeffectによる更新まで
 * 同期的に流し切るため、「最初の描画では止まっていて、effectで動く側に変わる」という
 * 中間フレームがテストからは見えないため。この中間フレームがあると、視差軽減を設定していない
 * ユーザーに完成形が一瞬見えてから再生し直される(資産推移に至っては再生されない)。
 */
describe("readPrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("設定していなければ、その場でfalseを返す(effectを待たない)", () => {
    stubMatchMedia(false);

    expect(readPrefersReducedMotion()).toBe(false);
  });

  it("視差効果を減らす設定ならtrueを返す", () => {
    stubMatchMedia(true);

    expect(readPrefersReducedMotion()).toBe(true);
  });

  it("matchMediaが無い環境ではアニメーションしない側(true)に倒す", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(readPrefersReducedMotion()).toBe(true);
  });
});

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("視差効果を減らす設定ならtrueを返す", () => {
    stubMatchMedia(true);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it("設定していなければfalseを返す(アニメーションする)", () => {
    stubMatchMedia(false);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  /** 判定が効かない環境で「動く」側に倒すと、最終状態だけを見たい呼び出し側が待たされる */
  it("matchMediaが無い環境ではアニメーションしない側(true)に倒す", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it("表示中にOSの設定が変わったら追従する", () => {
    const { change } = stubMatchMedia(false);
    const { result, rerender } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);

    change(true);
    rerender();

    expect(result.current).toBe(true);
  });
});
