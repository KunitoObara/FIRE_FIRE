import { NavigationProbe } from "@/components/NavigationProbe";

import type { JSX, ReactNode } from "react";

/**
 * 開発環境構築の動作確認用レイアウト。
 * ルート遷移をまたいでマウントされ続けるため、配下の NavigationProbe の状態が
 * クライアント遷移で保持されるかどうかを確認できる。
 *
 * 画面実装タスク(A1〜A7 / B1〜B10)の着手時に `(setup-check)` ごと削除してよい。
 */
export default function SetupCheckLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      {children}
      <NavigationProbe />
    </div>
  );
}
