import { defineSecret } from "firebase-functions/params";

/**
 * SentryのDSN([X3])。登録手順は docs/ci-cd-setup.md 15.6節。
 *
 * **各関数の`secrets`に入れないと実行時に値が読めない。** Secret Managerの値は
 * 関数へ明示的に結び付けたときだけ環境変数として渡るため、`defineSecret`しただけでは
 * 足りない。`RESEND_API_KEY`・`IDENTITY_PLATFORM_WEB_API_KEY`と同じ扱い。
 *
 * 未登録のままではデプロイが通らない(firebase-toolsが「シークレットが存在しない」で
 * 落とす)。つまり「DSNが無いまま動く本番」は起こらず、コード側で備えるのは
 * 値が空文字のときだけでよい。
 */
export const SENTRY_DSN = defineSecret("SENTRY_DSN");
