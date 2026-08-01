/**
 * A4に「ログアウトしました」を1回だけ出すための一過性フラグ(docs/screen-requirements-auth.md A4)。
 *
 * URLのクエリパラメータでは制御しない。クエリだと`/login?loggedOut=1`を直接開くだけで表示でき、
 * リロードでも消えないため、「自分でログアウトした直後の1回だけ・リロードで消える」の両方が
 * 成立しなくなる(HTMLモックの`?loggedOut=1`は静的ファイル間で状態を渡す手段が無いための代用で、
 * 実装では踏襲しない)。
 *
 * `pending-login.ts`と同じくモジュールスコープの変数に置く。ページの再読み込みで必ず消え、
 * ガードによる差し戻しやセッション期限切れではこのフラグが立たないため、自分でログアウトした
 * 場合とそれ以外を区別できる。
 */

let loggedOut = false;

/** ログアウトの実行に成功したときに立てる(`src/lib/auth/sign-out.ts`) */
export const markLoggedOut = (): void => {
  loggedOut = true;
};

/**
 * フラグを読み出し、同時に消費する。
 * A4のマウント時に一度だけ呼ぶ。呼び出し後は再度trueを返さないため、リロードや再訪問では出ない。
 */
export const consumeLoggedOutNotice = (): boolean => {
  const wasLoggedOut = loggedOut;
  loggedOut = false;
  return wasLoggedOut;
};
