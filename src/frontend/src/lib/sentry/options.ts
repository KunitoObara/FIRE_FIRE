/**
 * ブラウザ・Node・Edgeの3ランタイムで共有する`Sentry.init`の設定([X3])。
 *
 * 3つのランタイムはそれぞれ別の設定ファイルから初期化されるため、
 * ここに集めておかないと「片方だけスクラブが外れている」状態を作りやすい。
 */

import { scrubEvent, scrubLog } from "@/lib/sentry/scrub";

/**
 * SentryのDSN。未設定ならSentryを起動しない。
 *
 * Next.jsは`process.env.NEXT_PUBLIC_*`をリテラルのプロパティアクセスに限って
 * ビルド時に埋め込むため、動的なキー参照にはできない
 * (`src/lib/firebase/client.ts`と同じ制約)。
 *
 * 空文字を`undefined`に倒すのは、GitHub Actionsが未登録のSecretsを
 * 空文字として渡すため。フォークPRのビルドはこの経路で無効化される。
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

/**
 * どの環境から届いたイベントかを示すタグ。
 *
 * dev/prodは同一Sentryプロジェクトを`environment`で分ける方針(カード[X3])。
 * 専用の環境変数を増やさず、接続先Firebaseプロジェクトをそのまま使う
 * — 接続先と表示が食い違うことが原理的に起きないため。
 */
const environment = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown";

/**
 * 3ランタイム共通の設定。
 *
 * - `enabled`: DSNが無いビルド(フォークPRのCIやDSN未設定のローカル)では
 *   何も送らず、初期化そのものは通す。ここで例外にすると画面が落ちる。
 * - `tracesSampleRate: 0`: パフォーマンス監視は対象外(カード[X3]の設計方針4)。
 *   無料枠(5,000イベント/月)はエラー検知だけに使う。
 * - Session Replayは意図的に入れていない。DOMをそのまま録るため、
 *   B1の残高がSentry側に保存されてしまう。
 * - `sendDefaultPii: false`: IPアドレスやCookieを既定で送らせない。
 *   取りこぼしは`beforeSend`(`scrubEvent`)が受け止める。
 */
export const commonSentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: true,
  enableMetrics: false,
  beforeSend: scrubEvent,
  beforeSendLog: scrubLog,
} as const;
