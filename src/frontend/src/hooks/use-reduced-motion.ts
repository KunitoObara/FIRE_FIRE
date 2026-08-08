"use client";

import * as React from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * OS側で視差効果を減らす設定(`prefers-reduced-motion: reduce`)になっているかを返す
 * (DESIGN.md 9章)。
 *
 * 判定をここ1か所に置き、チャートごとに`matchMedia`を書かない(`use-mobile.ts`と同じ形)。
 * 同じ判定が複数箇所に散ると、チャートによってアニメーションが止まったり止まらなかったり
 * しうる。
 *
 * **取得できない場合は「アニメーションしない」側に倒す。** サーバー描画時と、`matchMedia`が
 * 無い環境(自動テストのjsdom)がこれに当たる。動かさない側を既定にすると、判定が効かない
 * 環境では最終状態だけが描かれ、要素の出現タイミングがアニメーションの有無で変わらない。
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(true);

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (): void => {
      setPrefersReducedMotion(mql.matches);
    };

    onChange();
    mql.addEventListener("change", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return prefersReducedMotion;
};
