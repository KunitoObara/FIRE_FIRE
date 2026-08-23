/**
 * サーバー側の初期化フック([X3])。
 * Next.jsがサーバー起動時に一度だけ`register`を呼ぶ。
 *
 * ランタイムごとに設定ファイルを分けるのは`@sentry/nextjs`の規約
 * — Edgeバンドルに`@sentry/node`が混ざらないよう、動的importで振り分ける。
 */

import * as Sentry from "@sentry/nextjs";

export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
};

/**
 * Server Components / Route Handlersで投げられた例外をSentryへ送る。
 * この名前でexportするとNext.jsが自動で呼ぶ。
 */
export const onRequestError = Sentry.captureRequestError;
