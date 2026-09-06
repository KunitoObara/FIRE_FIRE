import { withSentryConfig } from "@sentry/nextjs";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {/* config options here */};

/**
 * ソースマップをSentryへアップロードするための認証トークン([X3])。
 * ビルド時にだけ使い、実行時のバンドルには入らない(`NEXT_PUBLIC_`を付けない)。
 *
 * 空文字を`undefined`に倒す(`=== undefined`だけで判定しない)のは、
 * 空トークンでアップロードを試みてビルドを落とさないため。
 * CIはSENTRY_*をビルドに渡さないので([X28])いまは未定義側しか通らないが、
 * 空文字を渡す経路が増えたときに黙って落ちないよう、この分岐は残す。
 */
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || undefined;

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,

  /*
    トークンが無いビルドではアップロードごと止める。
    CIはSENTRY_*をビルドに渡さない([X28])ため、ここを止めないと
    「PRのビルドが必ず失敗する」状態を新しく作ることになる。
    フォークからのPRにはそもそもSecretsが渡らない(CLAUDE.md)ので、
    置き場をどちらにしてもこの分岐は要る。
    アップロードが無くてもエラー自体は届く — 行番号がminifyされたままになるだけ。
  */
  sourcemaps: { disable: sentryAuthToken === undefined },

  // ビルドログをSentryのイベント名で埋めない。失敗時は例外として出る。
  silent: true,

  // ビルド環境の情報をSentryへ送らない。
  telemetry: false,
});
