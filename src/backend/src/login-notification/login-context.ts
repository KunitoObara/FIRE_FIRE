/**
 * Blocking Functionsのイベントから、通知メールに載せる「誰がどうやって入ったか」を取り出す
 * (docs/auth-login-requirements.md 3.6 / 3.8)。
 *
 * ここは純粋な変換だけを持つ。送信や書式の都合はmessage.ts / mailer.ts側に置く。
 */

import type { AuthBlockingEvent } from "firebase-functions/identity";

/**
 * ログイン方法の表示名。
 *
 * 3.8の要件は「パスワード / Google」を区別できることなので、その2つを日本語にする。
 * 本アプリが用意する一次認証はこの2つだけなので、対応表もその2つに閉じる。
 *
 * 増やすのは、対応するログイン手段を実際に足すとき。未知のIDは「不明」に落とさず
 * そのまま表示するため(`resolveSignInMethodLabel`)、先回りして書いておく必要はない。
 * 想定外の手段でのサインインは、生のIDが本文に出ることでかえって気づける。
 */
const SIGN_IN_METHOD_LABELS: Record<string, string> = {
  password: "パスワード",
  "google.com": "Google",
};

/** ログイン方法を特定できなかったときの表示 */
const UNKNOWN_SIGN_IN_METHOD = "不明";

/**
 * 使われた一次認証の手段を表示用の文字列にする。
 *
 * `credential`はOAuth系のサインインでのみ載り、メール/パスワードでは
 * `additionalUserInfo.providerId`(`"password"`)側にしか出ない。どちらに入っていても
 * 拾えるよう、確度の高い順に見る。
 */
export const resolveSignInMethodLabel = (event: AuthBlockingEvent): string => {
  const identifier =
    event.credential?.signInMethod ??
    event.credential?.providerId ??
    event.additionalUserInfo?.providerId;

  if (identifier === undefined || identifier === "") {
    return UNKNOWN_SIGN_IN_METHOD;
  }

  return SIGN_IN_METHOD_LABELS[identifier] ?? identifier;
};

/** User-Agentからブラウザ名を判定する規則。前に置いたものを優先する */
const BROWSER_PATTERNS: { pattern: RegExp; name: string }[] = [
  // Edge・OperaのUAにはChromeの名前も含まれるため、Chromeより先に見る
  { pattern: /\bEdgA?\//, name: "Edge" },
  { pattern: /\bOPR\//, name: "Opera" },
  { pattern: /\bFirefox\/|\bFxiOS\//, name: "Firefox" },
  { pattern: /\bCriOS\//, name: "Chrome" },
  { pattern: /\bChrome\//, name: "Chrome" },
  // Safariの名前はChrome系のUAにも含まれるので最後に判定する
  { pattern: /\bSafari\//, name: "Safari" },
];

/** User-Agentからプラットフォーム名を判定する規則。前に置いたものを優先する */
const PLATFORM_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\biPhone\b/, name: "iOS" },
  { pattern: /\biPad\b/, name: "iPadOS" },
  // Androidは"Linux; Android"と名乗るためLinuxより先に見る
  { pattern: /\bAndroid\b/, name: "Android" },
  { pattern: /\bWindows NT\b/, name: "Windows" },
  { pattern: /\bMac OS X\b|\bMacintosh\b/, name: "macOS" },
  { pattern: /\bCrOS\b/, name: "ChromeOS" },
  { pattern: /\bLinux\b/, name: "Linux" },
];

const matchName = (
  patterns: { pattern: RegExp; name: string }[],
  userAgent: string,
): string | null => patterns.find(({ pattern }) => pattern.test(userAgent))?.name ?? null;

/**
 * User-Agentを「Chrome / macOS」のような短い表記にする。
 *
 * 判定できなければ`null`を返し、呼び出し側は生のUser-Agentだけを載せる。UAの書式は
 * 事業者の都合で変わるため、ここで無理に当てるより「判別できなかった」と示すほうが誤解が無い。
 * 生のUser-Agentは要約の成否に関わらずメールに残すので、判定漏れで情報が消えることはない。
 */
export const describeClient = (userAgent: string): string | null => {
  const browser = matchName(BROWSER_PATTERNS, userAgent);
  const platform = matchName(PLATFORM_PATTERNS, userAgent);

  if (browser === null && platform === null) {
    return null;
  }

  return [browser, platform].filter((part) => part !== null).join(" / ");
};
