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
 *
 * 読み出し(`wasLoggedOut`)と消費(`clearLoggedOutNotice`)を分けているのは、`pending-login.ts`の
 * `getPendingLogin`と同じ理由による。読み出しを`useState`のレイジー初期化子で使う場合、
 * React Strict Modeは初期化関数を2回呼ぶ(1回目の結果は破棄され、2回目の戻り値がコミットされる)。
 * 読み出しと消費が同じ関数だと1回目の呼び出しでフラグが消費され、2回目は必ずfalseを返してしまう。
 */

let loggedOut = false;

/** ログアウトの実行に成功したときに立てる(`src/lib/auth/sign-out.ts`) */
export const markLoggedOut = (): void => {
  loggedOut = true;
};

/** 副作用なく現在の値を読み出す。Strict Modeで複数回呼ばれても安全 */
export const wasLoggedOut = (): boolean => loggedOut;

/** 表示した後に消費する。以降の読み出しではfalseを返すため、再訪問時には出ない */
export const clearLoggedOutNotice = (): void => {
  loggedOut = false;
};
