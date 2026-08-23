"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

import type { JSX } from "react";

/**
 * ルートレイアウトごと巻き込んだ描画エラーの最後の受け皿([X3])。
 *
 * `instrumentation.ts`の`onRequestError`が拾うのはサーバー側のリクエスト処理中に
 * 投げられた例外だけで、クライアント側の描画エラーはReactのエラーバウンダリで
 * 伝播が止まる。Next.jsの規約上、ルートレイアウト自体のエラーを捕まえられるのは
 * このファイルだけなので、ここでSentryへ送る導線を持つ。
 *
 * **アプリ側のコンポーネントに依存しない。** ここが動くのは既に何かが壊れている
 * ときなので、共通ボタンやレイアウトを経由すると、その経路が壊れている場合に
 * 画面ごと出せなくなる。素の要素とTailwindのクラスだけで組む。
 *
 * **これは体裁を整えきれていないのではなく、要件である**
 * (docs/screen-list-and-transitions.md 2.6、[X3-2])。同じ理由でA11お問い合わせへの
 * 導線も置いていない。DESIGN.mdの体裁へ寄せるほど「壊れているときに出せない」
 * リスクが上がるため、寄せる場合は要件の側から見直すこと。
 *
 * この画面は**画面IDを持たない**。公開画面・認証系・ログイン後のどこでも出るため、
 * A0〜A12・B1〜B17のどれとも並列にならない(同2.6)。
 *
 * `globals.css`を読み直しているのは、このファイルがルートレイアウトを置き換える
 * ため — レイアウト側のimportが効かず、読まないとスタイルが当たらない。
 */

const GlobalError = ({ error, reset }: GlobalErrorProps): JSX.Element => {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">エラーが発生しました</h1>
        <p className="text-sm text-muted-foreground">
          画面を表示できませんでした。時間をおいて再度お試しください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          再読み込み
        </button>
      </body>
    </html>
  );
};

export default GlobalError;
