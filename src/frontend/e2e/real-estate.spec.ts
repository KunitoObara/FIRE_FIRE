import { expect, test } from "@playwright/test";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B5〜B7 不動産のE2Eテスト(7/10本目)。
 *
 * 一連のCRUDフロー(登録B7→詳細B6→編集B7→削除)を1本にまとめる
 * (docs/screen-list-and-transitions.md、B5単独では登録・編集・削除の実体が無く検証できない)。
 * **テストの最後に必ず削除して後始末する**(分割計画コメント参照、
 * https://trello.com/c/O02SOfp3)。削除は不動産自体で禁止されない(B4の分類軸に選んでいない
 * 限り、削除禁止の判定はB4側だけにある。docs/screen-requirements-real-estate.md「物件の削除」)。
 *
 * ログインは1回だけ行い(このファイルはテストが1本のみのため、storageState共有ヘルパーは
 * まだ使わない — 4本目のPRが未マージのため、5・6本目と同じ理由)。
 */

test("物件を登録し、詳細で利ざやを確認、編集を反映し、削除できる", async ({ page }) => {
  const propertyName = `E2Eテスト物件-${Date.now()}`;

  await loginWithTotp(page, getE2eTestAccount());

  // B5 → B7(新規登録)
  await page.goto("/real-estate");
  await page.getByRole("link", { name: "新規登録" }).click();
  await expect(page).toHaveURL(/\/real-estate\/new$/);

  await page.getByLabel("物件名").fill(propertyName);
  await page.getByLabel("時価(円)").fill("10000000");
  await page.getByLabel("ローン残高(円)").fill("3000000");
  await page.getByRole("button", { name: "保存" }).click();

  // 保存成功 → B6(登録した物件)
  await expect(page.getByText("物件を登録しました")).toBeVisible();
  await expect(page).toHaveURL(/\/real-estate\/[^/]+$/);
  await expect(page.getByRole("heading", { name: propertyName })).toBeVisible();
  await expect(page.getByText("¥ 10,000,000")).toBeVisible();
  await expect(page.getByText("¥ 3,000,000")).toBeVisible();
  // 利ざや(時価 - ローン残高 = 7,000,000)
  await expect(page.getByText("¥ 7,000,000")).toBeVisible();

  // B6 → B7(編集)
  await page.getByRole("link", { name: "編集" }).click();
  await expect(page).toHaveURL(/\/real-estate\/[^/]+\/edit$/);

  await page.getByLabel("時価(円)").fill("12000000");
  await page.getByRole("button", { name: "保存" }).click();

  // 保存成功 → B6(更新後の値)
  await expect(page.getByText("物件情報を更新しました")).toBeVisible();
  await expect(page.getByText("¥ 12,000,000")).toBeVisible();
  // 利ざや(12,000,000 - 3,000,000 = 9,000,000)
  await expect(page.getByText("¥ 9,000,000")).toBeVisible();

  // 後始末: 削除する
  await page.getByRole("button", { name: "削除" }).click();
  await expect(
    page.getByRole("alertdialog", { name: `「${propertyName}」を削除しますか?` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "削除する" }).click();

  // 削除成功 → B5(一覧から消えている)
  await expect(page.getByText("物件を削除しました")).toBeVisible();
  await expect(page).toHaveURL(/\/real-estate$/);
  await expect(page.getByText(propertyName)).toHaveCount(0);
});
