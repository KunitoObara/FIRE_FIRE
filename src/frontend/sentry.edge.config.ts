/**
 * Edgeランタイム(middleware等)側のSentry初期化([X3])。
 * `src/instrumentation.ts`から読み込まれる。
 *
 * 現時点でEdgeで動くコードは無いが、middlewareを足した時点で
 * 初期化漏れになるのを避けるため先に置いておく(ウィザードの既定構成)。
 */

import * as Sentry from "@sentry/nextjs";

import { commonSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...commonSentryOptions,
  // 他の2ランタイムと揃える。middlewareを足したときに、ここだけログが
  // 拾われない状態になるのを防ぐ。
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
});
