import { expect, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { generateTotpCode } from "./totp";

import type { E2eTestAccount } from "./env";

/**
 * ログイン済みstorageStateの保存先ディレクトリ(`.gitignore`で除外済み)。
 * 実際のFirebaseセッショントークンを含むため、コミット対象にしない。
 */
const AUTH_STATE_DIR = path.join(__dirname, "..", ".auth");

/**
 * A4ログイン → A5 2FA検証 を通して、B1ダッシュボードまで進める。
 *
 * 対象はA3で既にTOTP登録済みのアカウントのみ([X18]の設計方針2)。サインアップ・メール確認・
 * TOTP登録そのものの自動化はここでは行わない(初回セットアップは手動、[X18]対象範囲を参照)。
 */
export const loginWithTotp = async (page: Page, account: E2eTestAccount): Promise<void> => {
  await page.goto("/login");

  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "ログイン" }).click();

  // A4の一次認証が通るとA5(2FA検証)へ遷移する
  await expect(page).toHaveURL(/\/mfa-verify$/);

  // TOTPコードは30秒で切り替わる。入力直前に生成して古いコードを送らないようにする
  const code = generateTotpCode(account.totpSecret);
  await page.locator("#totp-code").pressSequentially(code);
  await page.getByRole("button", { name: "検証する" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
};

/**
 * ログイン済みstorageStateの保存先パスを、副作用無しに計算する。
 *
 * `test.use({ storageState })`はモジュール読み込み時(ファイル収集時)に評価されるため、
 * `beforeAll`が返す値を`test.use`に直接渡すことはできない(その時点では未確定)。
 * パス自体は`fileName`だけで決まる値なので、specファイル側はこの関数でモジュール
 * スコープの定数として計算し、`saveLoggedInStorageState`が書き込む先と同じパスを
 * 静的に参照する。
 */
export const getAuthStateFilePath = (fileName: string): string =>
  path.join(AUTH_STATE_DIR, fileName);

/**
 * ログイン(TOTP込み)を1回だけ行い、その後のセッションを`storageState`ファイルに保存する。
 *
 * B1以降のログイン後画面をテストするspecファイルは、`test.beforeAll`でこれを1回呼び、
 * `test.use({ storageState: getAuthStateFilePath(fileName) })`と組み合わせることで、
 * ファイル内の全テストが同じログイン済みセッションを共有できる。テストごとに
 * `loginWithTotp`を呼び直すと、テスト数だけIdentity Platformへの実サインインが走り、
 * レート制限への配慮([X18]の設計方針3)に反する。
 *
 * `fileName`はspecファイルごとに変える(例: `"dashboard.json"`)。同じ`workers: 1`の
 * プロセス内でも、複数のspecファイルが同じファイルへ同時に書き込むのを避けるため。
 */
export const saveLoggedInStorageState = async (
  browser: Browser,
  account: E2eTestAccount,
  fileName: string,
): Promise<void> => {
  const page = await browser.newPage();
  await loginWithTotp(page, account);

  // 初回実行時はディレクトリが無いため、書き込み前に用意する
  mkdirSync(AUTH_STATE_DIR, { recursive: true });
  await page.context().storageState({ path: getAuthStateFilePath(fileName) });
  await page.close();
};
