/**
 * Sentryへ送るイベントから個人情報を落とす([X3])。
 *
 * 方針はフロントエンド(`src/frontend/src/lib/sentry/scrub.ts`)と同じ
 * 「残すものを選ぶ」ではなく「疑わしいものを落とす」。任意のアプリ由来ペイロード
 * (`request`のボディ・クエリ・Cookie・ヘッダー、`extra`、パンくずの`data`)は
 * 中身を検査せず丸ごと捨て、文字列に混ざった識別子だけを個別に伏せる。
 *
 * **フロントエンドと違い、数字は落とさない。** 向こうは残高・収支が本文に混ざりうるため
 * 4桁以上の数字を伏せているが([X3-1])、バックエンドの9つの関数(2FA・ログイン通知・
 * プロバイダ連携・お問い合わせ・アカウント削除・許可リスト)は**金額を一切扱わない**。
 * ここで数字を潰すと、Identity PlatformやResendのステータスコードという
 * 唯一の切り分け材料を失うだけで、守るものが無い。
 *
 * 両者のコードを共有していないのは、フロント/バックエンドで`package.json`が分かれており
 * npm workspacesを導入していないため(`src/backend/docs/TECH_STACK.md`)。
 */

import type { ErrorEvent } from "@sentry/node";

/** 落とした値の跡地に残す目印。消えたのか元々無かったのかを区別できるようにする。 */
export const REDACTED = "[redacted]";

/**
 * メールアドレスらしき並び。
 *
 * バックエンドで最も漏れやすい識別子。お問い合わせ(A11)・ログイン通知・
 * 許可リストのいずれもメールアドレスを引数に取り、例外メッセージへ乗りうる。
 */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Firestoreのドキュメントパスに現れるUID(`users/xxxx`・`mfaRecoveryCodes/xxxx`)。
 *
 * 単独の英数字列まで対象にすると変数名やハッシュまで潰してしまうため、
 * UIDをドキュメントIDに使うコレクション名が前置きされている場合だけを狙う。
 */
const USER_DOCUMENT_PATH_PATTERN = /((?:users|mfaRecoveryCodes)\/)[A-Za-z0-9_-]{6,}/g;

/** 文字列から利用者を特定できる部分(メールアドレス・UID)を伏せる。 */
export const redactSensitiveText = (value: string): string =>
  value.replace(EMAIL_PATTERN, REDACTED).replace(USER_DOCUMENT_PATH_PATTERN, `$1${REDACTED}`);

type SentryRequest = NonNullable<ErrorEvent["request"]>;
type SentryBreadcrumb = NonNullable<ErrorEvent["breadcrumbs"]>[number];

/**
 * リクエスト情報を「どこを叩いたか」だけに削る。
 * ボディ・クエリ・Cookie・ヘッダーはいずれも認証情報や入力値の器なので残さない。
 */
const scrubRequest = (request: SentryRequest): SentryRequest => ({
  method: request.method,
  url: request.url === undefined ? undefined : redactSensitiveText(request.url.split(/[?#]/, 1)[0] ?? ""),
});

/** パンくずは「何が起きたか」の並びだけを残し、付随データは捨てる。 */
const scrubBreadcrumb = (breadcrumb: SentryBreadcrumb): SentryBreadcrumb => ({
  type: breadcrumb.type,
  level: breadcrumb.level,
  category: breadcrumb.category,
  timestamp: breadcrumb.timestamp,
  message: breadcrumb.message === undefined ? undefined : redactSensitiveText(breadcrumb.message),
});

/**
 * `Sentry.init`の`beforeSend`に渡す。イベントを送信直前に削る。
 *
 * `user`を丸ごと落とすのは、`sendDefaultPii: false`でもIPアドレスや`id`(=UID)が
 * 入りうるため。単一ユーザー運用(要件定義書2章)なので、誰のエラーかを区別する必要が
 * そもそも無い。
 */
export const scrubEvent = (event: ErrorEvent): ErrorEvent => ({
  ...event,
  user: undefined,
  extra: undefined,
  message: event.message === undefined ? undefined : redactSensitiveText(event.message),
  request: event.request === undefined ? undefined : scrubRequest(event.request),
  breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
  exception:
    event.exception === undefined
      ? undefined
      : {
          ...event.exception,
          values: event.exception.values?.map((value) => ({
            ...value,
            value: value.value === undefined ? undefined : redactSensitiveText(value.value),
          })),
        },
});
