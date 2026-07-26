import Link from "next/link";

import type { JSX } from "react";

/**
 * 開発環境構築の動作確認用のプレースホルダー画面。
 * 画面実装タスク(docs/screen-list-and-transitions.md の A1〜A7 / B1〜B10)で置き換える。
 */
const Home = (): JSX.Element => (
  <main className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">FIRE-FIRE</h1>
      <p className="text-muted-foreground">
        フロントエンド開発環境のセットアップ確認ページです。画面実装時に置き換えてください。
      </p>
    </header>

    <Link
      href="/spa-check"
      className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      確認ページへ移動
    </Link>
  </main>
);

export default Home;
