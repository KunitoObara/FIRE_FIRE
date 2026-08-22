/**
 * Sentryへ送るイベント・ログから個人情報と金銭情報を落とす([X3])。
 *
 * 本アプリは個人の資産・収支データを扱い、リポジトリも公開されている(CLAUDE.md)。
 * Sentryは外部サービスなので、「利用者を特定できる値」と「金額そのもの」は
 * 送らないことを既定にする。`sendDefaultPii: false`だけでは足りない
 * — 例外メッセージやログの引数には、SDKの与り知らないところで
 * メールアドレスや残高が混ざりうるため。
 *
 * 方針は「残すものを選ぶ」ではなく「疑わしいものを落とす」。
 * デバッグに効く情報(例外の型・スタックトレース・発生箇所)は残しつつ、
 * 任意のアプリ由来ペイロード(`request.data`・`extra`・パンくずの`data`)は
 * 中身を検査せず丸ごと捨てる。個々の値を見て判断すると、
 * 新しい画面が増えたときに漏れる側に倒れる。
 */

import type { ErrorEvent, Log } from "@sentry/nextjs";

/** 落とした値の跡地に残す目印。消えたのか元々無かったのかを区別できるようにする。 */
export const REDACTED = "[redacted]";

/**
 * メールアドレスらしき並び。
 * 利用者の識別子であり、A11のお問い合わせやA1のサインアップの
 * エラーメッセージに乗りうる。
 */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Firestoreのドキュメントパスに現れるUID(`users/xxxx`)。
 * 単独の英数字列まで対象にすると変数名やハッシュまで潰してしまうため、
 * `users/`が前置きされている場合だけを狙う。
 */
const USER_DOCUMENT_PATH_PATTERN = /(users\/)[A-Za-z0-9_-]{6,}/g;

/** SDKが自分で付ける属性の接頭辞。アプリ由来の値ではないので残す。 */
const SDK_ATTRIBUTE_PREFIX = "sentry.";

/** 文字列から利用者を特定できる部分(メールアドレス・UID)を伏せる。 */
export const redactSensitiveText = (value: string): string =>
  value.replace(EMAIL_PATTERN, REDACTED).replace(USER_DOCUMENT_PATH_PATTERN, `$1${REDACTED}`);

/**
 * URLからクエリ文字列とフラグメントを落とし、パス部分だけにする。
 * 画面遷移のパラメータには対象月や物件IDが乗るため、パス以外は残さない。
 * 相対URLも渡されうるので`new URL()`は使わない(絶対URLでないと例外になる)。
 */
export const stripUrlParameters = (url: string): string =>
  redactSensitiveText(url.split(/[?#]/, 1)[0] ?? "");

type SentryRequest = NonNullable<ErrorEvent["request"]>;
type SentryBreadcrumb = NonNullable<ErrorEvent["breadcrumbs"]>[number];

/**
 * リクエスト情報を「どこを叩いたか」だけに削る。
 * ボディ・クエリ・Cookie・ヘッダーはいずれも認証情報や入力値の器なので残さない。
 */
const scrubRequest = (request: SentryRequest): SentryRequest => ({
  method: request.method,
  url: request.url === undefined ? undefined : stripUrlParameters(request.url),
});

/**
 * パンくずは「何が起きたか」の並びだけを残し、付随データは捨てる。
 * fetchのパンくずには送信ボディが、UIのパンくずには入力値が入りうる。
 */
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
 * `user`を丸ごと落とすのは、`sendDefaultPii: false`でもIPアドレスや
 * `id`(=UID)が入りうるため。単一ユーザー運用(要件定義書2章)なので、
 * 誰のエラーかを区別する必要がそもそも無い。
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

/**
 * ログの属性を削る。SDK自身が付ける`sentry.*`(リリース・環境など)は残し、
 * アプリ由来の属性は文字列なら伏せ、それ以外の型は値ごと落とす。
 *
 * 数値を落とすのは、このアプリで数値といえば残高・収支・ローン残高だから。
 * ステータスコードや件数も巻き添えになるが、金額が一つ漏れる方が高くつく。
 */
const scrubLogAttributes = (attributes: Log["attributes"]): Log["attributes"] => {
  if (attributes === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => {
      if (key.startsWith(SDK_ATTRIBUTE_PREFIX)) {
        return [key, value];
      }
      if (typeof value === "string") {
        return [key, redactSensitiveText(value)];
      }
      if (typeof value === "boolean") {
        return [key, value];
      }
      return [key, REDACTED];
    }),
  );
};

/**
 * `Sentry.init`の`beforeSendLog`に渡す。
 * `message`はテンプレート文字列型(`ParameterizedString`)だが、
 * 実体はただの文字列なので置換してから型を戻す。
 */
export const scrubLog = (log: Log): Log => ({
  ...log,
  message: redactSensitiveText(log.message) as Log["message"],
  attributes: scrubLogAttributes(log.attributes),
});
