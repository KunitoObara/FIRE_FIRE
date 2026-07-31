/** 開発時だけ有効になる動作の設定 */

/**
 * ログイン後画面(B1〜B10)の認証ガードを迂回するか。
 *
 * Authエミュレータは多要素認証をSMSでしか実装しておらず、TOTPの登録要求を拒否する
 * (README「ローカルで確認できないもの」)。そのためローカルでは2FA登録済みの状態を作れず、
 * `AppAccessGuard`が必ずA3 2FA登録画面へ送り返してしまい、ログイン後の画面を一切開けない。
 * この迂回はその1点を解消するためだけのもので、認証を「モックする」ものではない。
 *
 * **本番ビルドでは有効にできない。** `next build` は`NODE_ENV`を`production`にするため、
 * 環境変数の側を仮に`true`にしてもここは`false`を返す。加えてNext.jsは
 * `process.env.NODE_ENV`をビルド時にリテラルへ置き換えるので、迂回する側の分岐は
 * 本番の成果物からは消える。
 *
 * 迂回中はサインインしていないため`auth.currentUser`は`null`のままである。
 * 今後ログイン後の画面がUIDやメールアドレスを必要とするようになったら、
 * この迂回だけでは足りなくなる点に注意する。
 */
export const isAppAccessGuardBypassed = (): boolean =>
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD === "true";

/**
 * 迂回中であることを画面に出す文言。
 *
 * ログイン済みだと勘違いしたまま画面の挙動を確認してしまうと、認証まわりの不具合を
 * 見落とすため、迂回中は必ず画面上で分かるようにする。
 */
export const APP_ACCESS_GUARD_BYPASS_NOTICE =
  "開発用にログイン判定を迂回して表示しています(実際にはサインインしていません)。";

/** 上記の文言に添える、迂回を止める方法 */
export const APP_ACCESS_GUARD_BYPASS_HOW_TO_DISABLE =
  ".env.local の NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD を false にすると通常の認証ガードに戻ります。";
