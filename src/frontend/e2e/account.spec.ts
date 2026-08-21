import { expect, test } from "@playwright/test";

import { loginWithTotp } from "./helpers/auth";
import { getE2eDisposableTestAccount, getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B10 アカウント設定のE2Eテスト(10/10本目、最終)。
 *
 * B10の操作の多くは元に戻せない、または共有アカウントの状態を壊す。分割計画コメント
 * (https://trello.com/c/O02SOfp3)のとおり、安全さで2つに分ける。
 *
 * - **共有のE2E_TEST_EMAILで安全に検証できるもの**: 表示専用のアカウント情報、パスワード
 *   変更メールの送信(メール送信のみでアカウントは変化しない)、リカバリーコードの再発行
 *   (何度実行しても最終的に「8本」になるだけで、他のspecはTOTPログインしかしないため
 *   影響しない)
 * - **専用の使い捨てアカウントが必要なもの**: アカウント削除(取り消せない)。
 *   `E2E_TEST_DISPOSABLE_*`が未設定の間は`test.skip`で見送る
 *
 * **「2FAを再設定する」は対象外とした。** 共有アカウントに対して実行すると、他の全spec
 * ファイルが使うTOTPのシークレットが無効になり、以降のE2E実行がすべて壊れる。使い捨て
 * アカウントで実行しても、そのままではA3が未完了の状態になり、後続のアカウント削除の
 * 前提(サインイン済み)が保てるかが検証コード頼みで確信を持てないため、削除フローの
 * 検証を優先し2FA再設定は見送った。
 *
 * ログインは1回だけ行い(storageState共有ヘルパーはまだ使わない — 4本目のPRが
 * 未マージのため、5〜9本目と同じ理由)。
 */

test("アカウント情報を表示し、パスワード変更メールの送信とリカバリーコードの再発行ができる", async ({
  page,
}) => {
  const account = getE2eTestAccount();

  await loginWithTotp(page, account);
  await page.goto("/account");

  await expect(page.getByRole("heading", { name: "アカウント情報" })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();
  await expect(page.getByText("有効")).toBeVisible();

  // パスワード変更メールの送信(アカウントの状態は変わらない)
  await page.getByRole("button", { name: "パスワード変更メールを送信する" }).click();
  await expect(
    page.getByText(
      `${account.email} 宛にパスワード変更用のメールを送信しました。メールに記載のリンクから手続きを進めてください。`,
    ),
  ).toBeVisible();

  // リカバリーコードの再発行(A3で既に発行済みのため「再発行」側になる)。
  // 実行するたびに8本へ揃うだけで、他のspecが使うTOTPログインには影響しない
  await page.getByRole("button", { name: "リカバリーコードを再発行する" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "リカバリーコードを再発行しますか?" }),
  ).toBeVisible();
  await page.getByLabel("パスワード").fill(account.password);
  await page.getByRole("button", { name: "確認して再発行する" }).click();

  await expect(page.getByText("残り 8 / 8 本")).toBeVisible();
});

test("使い捨てアカウントを削除できる", async ({ page }) => {
  const account = getE2eDisposableTestAccount();
  test.skip(
    account === null,
    "E2E_TEST_DISPOSABLE_EMAIL/PASSWORD/TOTP_SECRETが未設定のため見送り(要セットアップ、Trelloカード[X19]参照。このテストは実行するたびにアカウントを消費する)",
  );
  if (account === null) {
    return;
  }

  await loginWithTotp(page, account);
  await page.goto("/account");

  await page.getByRole("button", { name: "アカウントを削除する" }).click();
  await expect(page.getByRole("alertdialog", { name: "アカウントを削除しますか?" })).toBeVisible();
  await page.getByLabel("登録メールアドレス").fill(account.email);
  await page.getByLabel("パスワード").fill(account.password);
  await page.getByRole("button", { name: "完全に削除する" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText(
      "アカウントとデータを削除しました。ご利用ありがとうございました。再度ご利用になる場合は、あらためて招待をお受けください。",
    ),
  ).toBeVisible();
});
