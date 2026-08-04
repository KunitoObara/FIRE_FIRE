/**
 * Googleログイン(A1・A4)とA8アカウント連携の間で、連携待ちの資格情報を受け渡すための置き場。
 *
 * 同一メールアドレスのパスワードアカウントが既にある場合、Googleのポップアップ自体は成功するが
 * サインインは成立せず`auth/account-exists-with-different-credential`となる。このとき返る
 * OAuthクレデンシャルを使って、A8でのパスワード検証(と2FA検証)のあとに連携を実行する。
 *
 * 保持先をメモリに限るのは`pending-login.ts`と同じ理由に加えて、OAuthクレデンシャルが短命な
 * ためでもある(docs/auth-login-requirements.md 3.8)。永続化すると、期限切れの資格情報で
 * 連携を試みることになる。A8をリロード・直接アクセスした場合は必ず空になり、A4へ戻せばよい。
 *
 * 2FA登録済みのアカウントでは、A8のパスワード検証のあとA5の確認コード検証を挟んでから連携する。
 * その間もこの変数が値を保つ必要があるため、A8では消費しない(`src/lib/auth/google-sign-in.ts`の
 * `linkPendingGoogleAccount`が実行時に消費する)。
 *
 * 読み出し(`getPendingGoogleLink`)と消費(`clearPendingGoogleLink`)を分けている理由は
 * `pending-login.ts`と同じで、React Strict Modeの二重呼び出しでも結果が変わらないようにするため。
 */

let pendingGoogleLink: PendingGoogleLink | null = null;

/** 連携が必要と判明したときに預ける(`src/lib/auth/google-sign-in.ts`) */
export const setPendingGoogleLink = (link: PendingGoogleLink): void => {
  pendingGoogleLink = link;
};

/** 副作用なく読み出す。Strict Modeで複数回呼ばれても安全 */
export const getPendingGoogleLink = (): PendingGoogleLink | null => pendingGoogleLink;

/** 連携待ちを捨てる(連携の実行時・「連携せずにログインへ戻る」・ログインのやり直し時) */
export const clearPendingGoogleLink = (): void => {
  pendingGoogleLink = null;
};
