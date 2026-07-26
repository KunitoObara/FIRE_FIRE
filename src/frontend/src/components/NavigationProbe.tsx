"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import type { JSX } from "react";

/**
 * SPA的な挙動(TECH_STACK.md 0章)の確認用プローブ。
 *
 * このコンポーネントは `(setup-check)` レイアウト直下でマウントされるため、
 * `next/link` によるクライアント遷移ではアンマウントされずカウンタの値が保持される。
 * フルページリロードが起きた場合はカウンタが0に戻るため、目視で判別できる。
 *
 * 開発環境構築の動作確認専用。画面実装が始まったら `(setup-check)` ごと削除してよい。
 */
export function NavigationProbe(): JSX.Element {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const handleIncrement = (): void => {
    setCount((current) => current + 1);
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">現在のパス</dt>
        <dd className="font-mono">{pathname}</dd>
        <dt className="text-muted-foreground">カウンタ</dt>
        <dd className="font-mono tabular-nums">{count}</dd>
      </dl>
      <button
        type="button"
        onClick={handleIncrement}
        className="w-fit rounded-md border border-border px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        カウンタを +1
      </button>
      <p className="text-muted-foreground">
        カウンタを増やしてからリンクで遷移し、値が保持されていればフルページリロードは
        発生していません(リロードすると0に戻ります)。
      </p>
    </section>
  );
}
