/**
 * 一次認証(A4)と二次認証(A5)の間で、検証セッションを受け渡すための置き場。
 *
 * 2FA登録済みのユーザーは`signInWithEmailAndPassword`が成功せず、Firebaseが返す
 * `MultiFactorResolver`を使って確認コードを検証して初めてログインが完了する。
 * このresolverは関数を含みJSONへ直列化できないため、`sessionStorage`等には置けない。
 *
 * 保持先をメモリに限ることで、A5をリロードしたり直接開いたりした場合は必ず空になる。
 * A5はその場合A4へ戻せばよい。ただしSPA遷移だけならこの変数は残るため、
 * 古い検証待ちが次のログインに紛れ込まないよう、A4は試行のたびに`clearPendingLogin`する
 * (`src/lib/auth/sign-in.ts`)。
 */

let pendingLogin: PendingLogin | null = null;

/** 一次認証の通過時に、A5が必要とする情報を預ける(A4) */
export const setPendingLogin = (login: PendingLogin): void => {
  pendingLogin = login;
};

/**
 * 預けられた情報を取り出して破棄する(A5)。
 *
 * 取り出しと破棄を分けないのは、検証の成否に関わらずresolverが一度きりの
 * 検証セッションを指すため。使い回されないようここで確実に捨てる。
 */
export const consumePendingLogin = (): PendingLogin | null => {
  const login = pendingLogin;
  pendingLogin = null;
  return login;
};

/** 検証待ちの状態を捨てる(ログインのやり直し・サインアウト時) */
export const clearPendingLogin = (): void => {
  pendingLogin = null;
};
