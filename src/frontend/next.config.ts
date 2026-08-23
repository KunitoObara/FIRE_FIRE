import { withSentryConfig } from "@sentry/nextjs";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {/* config options here */};

/**
 * ソースマップをSentryへアップロードするための認証トークン([X3])。
 * ビルド時にだけ使い、実行時のバンドルには入らない(`NEXT_PUBLIC_`を付けない)。
 *
 * 空文字を`undefined`に倒すのは、GitHub Actionsが未登録のSecretsを
 * 空文字として渡すため。`=== undefined`だけで判定すると、
 * 空トークンでアップロードを試みてビルドが落ちる。
 */
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || undefined;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,

  /*
    トークンが無いビルドではアップロードごと止める。
    フォークからのPRにはSecretsが渡らない(CLAUDE.md)ため、ここを止めないと
    「フォークPRのビルドが必ず失敗する」状態を新しく作ることになる。
    アップロードが無くてもエラー自体は届く — 行番号がminifyされたままになるだけ。
  */
  sourcemaps: { disable: sentryAuthToken === undefined },

  // ビルドログをSentryのイベント名で埋めない。失敗時は例外として出る。
  silent: true,

  // ビルド環境の情報をSentryへ送らない。
  telemetry: false,
});
