"use client";

import * as React from "react";

import { CHART_ANIMATION_DURATION_MS } from "@/constants/dashboard";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * 登場アニメーションの進捗(0〜1)。`ease-out`相当のイージング(easeOutCubic)を掛けた値を返す。
 *
 * CSSの`ease-out`とは曲線が違うが、**同じ進捗値から複数の描画を行う**ことが目的なので
 * 揃えるべきなのは曲線の種類ではなく出所のほうになる。FIRE達成度ゲージはリングと中央の%を
 * この1つの戻り値から描くため、両者がずれることが原理的に起こらない(DESIGN.md 9章)。
 */
const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3;

/**
 * 0から1へ`durationMs`かけて進む進捗を返す(DESIGN.md 9章)。
 *
 * `resetKey`が変わったときだけ最初から再生する。データが変わらないままの再レンダリング
 * (ホバー・リサイズ・スクロール)では再生しない、という要件をこの引数で表す。
 *
 * `prefers-reduced-motion: reduce`のときは再生せず、最初から1(=最終状態)を返す。
 */
export const useAnimatedProgress = (
  resetKey: unknown,
  durationMs: number = CHART_ANIMATION_DURATION_MS,
): number => {
  const prefersReducedMotion = usePrefersReducedMotion();
  // 進捗と「どの再生のものか」を1つのstateで持つ。別々にすると、キーだけ新しく進捗は
  // 前回の1のまま、という中間状態が1フレーム描かれうる
  const [animation, setAnimation] = React.useState({ key: resetKey, progress: 0 });

  /*
    キーが変わったらその場で0に戻す(Reactの「propsの変更に応じたstateの調整」)。
    effectで戻すと、再生をやり直すまでの1フレームだけ前回の最終状態が残る。
  */
  if (!Object.is(animation.key, resetKey)) {
    setAnimation({ key: resetKey, progress: 0 });
  }

  React.useEffect(() => {
    // 視差効果を減らす設定では再生しない。短くするのではなく行わない(戻り値は常に1)
    if (prefersReducedMotion) {
      return;
    }

    let frame = 0;
    const start = performance.now();

    const step = (now: number): void => {
      const elapsed = Math.min((now - start) / durationMs, 1);

      setAnimation({ key: resetKey, progress: easeOutCubic(elapsed) });

      if (elapsed < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    // アンマウント後に描画を続けない。B1は分類軸の切替で再描画が起きる画面で、
    // 止め忘れると外れたコンポーネントの更新が積み上がる
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [durationMs, prefersReducedMotion, resetKey]);

  return prefersReducedMotion ? 1 : animation.progress;
};
