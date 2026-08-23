/**
 * Node.jsランタイム(Server Components / Route Handlers / Server Actions)側の
 * Sentry初期化([X3])。`src/instrumentation.ts`から読み込まれる。
 */

import * as Sentry from "@sentry/nextjs";

import { commonSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...commonSentryOptions,
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
});
