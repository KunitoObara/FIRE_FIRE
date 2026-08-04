/**
 * B1に「Googleアカウントの連携ができませんでした」を1回だけ出すための一過性フラグ
 * (docs/screen-requirements-dashboard.md B1「Googleアカウント連携の失敗通知」)。
 *
 * 連携の成否にかかわらずサインイン自体は成立しているため、失敗してもログインはやり直させず、
 * B1到達時にトーストで伝える。通知済みフラグをFirestoreやカスタムクレームに永続化しないのは
 * 要件どおりで、連携失敗はA8を経由したログインの直後にしか起こらず、A8の連携セッションと
 * 同じくメモリ上で引き回せば足りるため。
 *
 * `logout-notice.ts`と同じ形にしてある。読み出しと消費を分けている理由もそちらと同じで、
 * React Strict Modeが`useState`のレイジー初期化子を2回呼んでもフラグが失われないようにするため。
 */

let googleLinkFailed = false;

/** 連携の実行に失敗したときに立てる(`src/lib/auth/google-sign-in.ts`) */
export const markGoogleLinkFailed = (): void => {
  googleLinkFailed = true;
};

/** 副作用なく現在の値を読み出す。Strict Modeで複数回呼ばれても安全 */
export const wasGoogleLinkFailed = (): boolean => googleLinkFailed;

/** 通知した後に消費する。以降の読み出しではfalseを返すため、次のログインでは出ない */
export const clearGoogleLinkFailureNotice = (): void => {
  googleLinkFailed = false;
};
