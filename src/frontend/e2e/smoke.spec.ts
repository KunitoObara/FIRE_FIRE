import { expect, test } from "@playwright/test";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X18] E2Eテスト基盤の疎通テスト。
 *
 * 目的は基盤(Playwright起動・fire-fire-devへの接続・TOTP自動生成)が機能することの確認であり、
 * B1の表示内容そのものの検証ではない。画面別の網羅的なテストケースは[X19]で追加する。
 */
test("ログインしてB1ダッシュボードまで到達できる", async ({ page }) => {
  const account = getE2eTestAccount();

  await loginWithTotp(page, account);

  await expect(page).toHaveTitle("ダッシュボード | FIRE-FIRE");
});
