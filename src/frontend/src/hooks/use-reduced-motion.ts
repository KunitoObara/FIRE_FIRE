"use client";

import * as React from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * いまの`prefers-reduced-motion`の状態を読む。
 *
 * **取得できない場合は「アニメーションしない」側に倒す。** サーバー描画時と、`matchMedia`が
 * 無い環境(自動テストのjsdom)がこれに当たる。動かさない側を既定にすると、判定が効かない
 * 環境では最終状態だけが描かれ、要素の出現タイミングがアニメーションの有無で変わらない。
 */
export const readPrefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

/**
 * OS側で視差効果を減らす設定(`prefers-reduced-motion: reduce`)になっているかを返す
 * (DESIGN.md 9章)。
 *
 * 判定をここ1か所に置き、チャートごとに`matchMedia`を書かない(`use-mobile.ts`と同じ形)。
 * 同じ判定が複数箇所に散ると、チャートによってアニメーションが止まったり止まらなかったり
 * しうる。
 *
 * **判定はstateの遅延初期化で行い、effectでの上書きに頼らない。** effectはブラウザが最初の
 * 描画を終えたあとに動くため、初期値を「アニメーションしない」に固定してeffectで倒すと、
 * 視差軽減を設定していない大多数のユーザーで
 *
 * 1. 最初の描画で最終状態(ゲージなら達成率のまま・リングも満了)が1フレーム見える
 * 2. effectが動いて0へ戻り、あらためて再生される
 *
 * という「完成形が一瞬見えてから作り直される」見え方になる。Rechartsに任せている資産推移に
 * 至っては、最終値で描き終えたあとに`isAnimationActive`が有効化されるため補間すべき差分が
 * 残らず、登場アニメーションが一度も再生されないことになる。
 *
 * 遅延初期化は水和のずれを生まない。この判定を使う3つのチャートはいずれも
 * `dynamic(..., { ssr: false })` 経由で、サーバーでは描画されないため。
 *
 * effectは**設定が変わったときの追従**のために残す。表示したままOSの設定を変えた場合に、
 * 次に再生されるアニメーションから新しい設定が効く。
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(readPrefersReducedMotion);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (): void => {
      setPrefersReducedMotion(mql.matches);
    };

    // 描画からこのeffectまでの間に設定が変わっていた場合に備えて一度読み直す
    onChange();
    mql.addEventListener("change", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return prefersReducedMotion;
};
