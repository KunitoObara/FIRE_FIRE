/** 開発時だけ有効になる動作の設定 */

/**
 * ログイン後画面(B1〜B10)の認証ガードを迂回するか。
 *
 * サインアップ → メール確認 → TOTP登録という一連の流れを毎回通さなくても、
 * ログイン後の画面の見た目や遷移だけを素早く確認できるようにするための開発用の迂回。
 * 認証を「モックする」ものではなく、単に`AppAccessGuard`の判定を飛ばすだけ。
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
