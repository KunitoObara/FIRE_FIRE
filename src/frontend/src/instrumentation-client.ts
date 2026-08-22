/**
 * ブラウザ側のSentry初期化([X3])。
 * Next.jsがクライアントバンドルの先頭で読み込む(`instrumentation-client.ts`は規約の名前)。
 */

import * as Sentry from "@sentry/nextjs";

import { commonSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...commonSentryOptions,
  /*
    console.warn / console.error をSentryのログとして送る。
    既存コードは「送信失敗はログに残すだけで握りつぶす」設計(ログイン通知メール・
    お問い合わせメール)なので、その握りつぶした失敗を拾う唯一の経路になる。
    log / info まで拾うと無料枠を通常操作で食い潰すため、警告以上に絞る。
  */
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
});

/**
 * 画面遷移の開始をSDKへ知らせるフック。この名前でexportするとNext.jsが自動で呼ぶ。
 *
 * 計測そのものは`tracesSampleRate: 0`で送られないが、exportしないとSDKが
 * 毎回のビルドで「ACTION REQUIRED」を出すため、口だけ繋いでおく。
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
