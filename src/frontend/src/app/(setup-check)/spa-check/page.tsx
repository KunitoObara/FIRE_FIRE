import Link from "next/link";

import type { JSX } from "react";

/**
 * `next/link` によるクライアント遷移がフルリロードを起こさないことを確認するための画面。
 * 開発環境構築の動作確認専用で、画面実装が始まったら `(setup-check)` ごと削除してよい。
 */
const SpaCheckPage = (): JSX.Element => (
  <main className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">遷移確認ページ</h1>
      <p className="text-muted-foreground">
        カウンタの値がトップページから引き継がれていれば、SPA的な遷移ができています。
      </p>
    </header>

    <Link
      href="/"
      className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      トップページへ戻る
    </Link>
  </main>
);

export default SpaCheckPage;
