import { expect, type Page } from "@playwright/test";

import { generateTotpCode } from "./totp";

import type { E2eTestAccount } from "./env";

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
