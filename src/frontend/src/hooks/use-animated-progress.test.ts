import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAnimatedProgress } from "@/hooks/use-animated-progress";

/** `prefers-reduced-motion`の判定を差し替える(この hook は`usePrefersReducedMotion`経由で見る) */
const stubReducedMotion = (matches: boolean): void => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
};

/** `requestAnimationFrame`と`performance.now`を偽のタイマーで進める */
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

/**
 * 再生が終わるまで進める。
 *
 * 再生時間ちょうどでは終わらない。最後のフレームが再生時間の直前に落ちると、進捗を1に
 * 丸めるのは**その次のフレーム**になるため(実際のブラウザでも同じ)。
 * フレームの刻みに依存しない検証にするため、再生時間より少し長く進める。
 */
const advancePastEnd = (durationMs: number): void => {
  advance(durationMs + 100);
};

describe("useAnimatedProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("再生中は0から始まり、再生時間の経過後に1になる", () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useAnimatedProgress("key", 600));

    expect(result.current).toBe(0);

    advance(300);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1);

    advancePastEnd(300);
    expect(result.current).toBe(1);
  });

  /** `ease-out`相当。序盤に大きく進み、終盤で緩やかになる */
  it("進み方はイージングが掛かっており、等速ではない", () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useAnimatedProgress("key", 600));

    advance(300);

    // easeOutCubic の 50% 地点は 0.875。等速(0.5)とは明確に違う
    expect(result.current).toBeGreaterThan(0.8);
    expect(result.current).toBeLessThan(0.95);
  });

  /** 短くするのではなく行わない(DESIGN.md 9章) */
  it("視差効果を減らす設定では再生せず、最初から1を返す", () => {
    stubReducedMotion(true);
    const { result } = renderHook(() => useAnimatedProgress("key", 600));

    expect(result.current).toBe(1);

    advancePastEnd(600);
    expect(result.current).toBe(1);
  });

  it("同じキーのまま再レンダリングしても再生し直さない", () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ key }) => useAnimatedProgress(key, 600), {
      initialProps: { key: "same" },
    });

    advancePastEnd(600);
    expect(result.current).toBe(1);

    rerender({ key: "same" });

    expect(result.current).toBe(1);
  });

  it("キーが変わったら最初から再生し直す", () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ key }) => useAnimatedProgress(key, 600), {
      initialProps: { key: "before" },
    });

    advancePastEnd(600);
    expect(result.current).toBe(1);

    rerender({ key: "after" });

    expect(result.current).toBe(0);
  });
});
