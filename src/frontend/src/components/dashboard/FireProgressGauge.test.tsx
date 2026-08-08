import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FireProgressGauge } from "@/components/dashboard/FireProgressGauge";

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

/** ゲージ中央の%。読み上げ対象ではない(`aria-hidden`)ので文字列で拾う */
const gaugeLabel = (): HTMLElement => screen.getByText(/%$/u);

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("FireProgressGauge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("0%から達成率までカウントアップする", () => {
    stubReducedMotion(false);
    render(<FireProgressGauge achievementRate={0.62} />);

    expect(gaugeLabel()).toHaveTextContent("0%");

    advance(700);

    expect(gaugeLabel()).toHaveTextContent("62%");
  });

  /** 短くするのではなく行わない(DESIGN.md 9章) */
  it("視差効果を減らす設定では最終状態を即座に描く", () => {
    stubReducedMotion(true);
    render(<FireProgressGauge achievementRate={0.62} />);

    expect(gaugeLabel()).toHaveTextContent("62%");
  });

  /**
   * リングと中央の%は同じ進捗値から描くので、途中の値も必ず整合する。
   * 中央が最終値のままリングだけ遅れて伸びる、という食い違いが起こらないことの確認。
   */
  it("再生中の%は0と達成率の間に収まる", () => {
    stubReducedMotion(false);
    render(<FireProgressGauge achievementRate={0.62} />);

    advance(100);

    const shown = Number(gaugeLabel().textContent?.replace("%", ""));

    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(62);
  });

  /** 塗りは100%で止めるが、中央の数値は超過分をそのまま出す */
  it("目標を超えている場合は100%を超える数値を出す", () => {
    stubReducedMotion(true);
    render(<FireProgressGauge achievementRate={1.25} />);

    expect(gaugeLabel()).toHaveTextContent("125%");
  });

  /**
   * 再生するのは初回描画時のみ(DESIGN.md 9章)。画面を開いたまま裏で取り直しが走って
   * 達成率が変わっても、リングを0%から引き直さない。
   */
  it("マウントしたまま達成率が変わっても再生し直さない", () => {
    stubReducedMotion(false);
    const { rerender } = render(<FireProgressGauge achievementRate={0.62} />);

    advance(700);
    expect(gaugeLabel()).toHaveTextContent("62%");

    rerender(<FireProgressGauge achievementRate={0.7} />);

    // 0%へ戻らず、新しい達成率がそのまま出る
    expect(gaugeLabel()).toHaveTextContent("70%");
  });
});
