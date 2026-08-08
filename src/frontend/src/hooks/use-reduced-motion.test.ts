import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

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
