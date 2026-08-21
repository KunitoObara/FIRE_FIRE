import { expect, test } from "@playwright/test";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B4 資産分類マスタ設定画面のE2Eテスト(6/10本目)。
 *
 * 分類軸を1つ作成し、一覧への反映・削除までを確認する。**テストの最後に必ず削除して
 * 後始末する**(分割計画コメント参照、https://trello.com/c/O02SOfp3)。作成する軸は
 * 資産種別・負債・不動産のいずれも選択しない最小構成にする — 選択が空のときの保存値
 * (`assetTypeNames`が空配列)は削除禁止の判定([`DeleteCategoryAxisDialog.tsx`]の
 * `axis.assetTypeNames.length > 0`)に引っかからないため、E2E_TEST_EMAILに既に
 * CSV取込データがあるかどうかに関わらず、作成した軸を確実に削除できる。
 *
 * ログインは1回だけ行い(このファイルはテストが1本のみのため、[4本目]で新設した
 * storageState共有ヘルパーはまだ使わない — 4本目のPRが未マージのため)。
 */

test("分類軸を追加し、一覧に反映され、削除できる", async ({ page }) => {
  const axisName = `E2Eテスト分類軸-${Date.now()}`;

  await loginWithTotp(page, getE2eTestAccount());
  await page.goto("/asset-categories");

  await page.getByRole("button", { name: "新規分類を追加" }).click();
  await page.getByLabel("分類名").fill(axisName);
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("分類を追加しました")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: axisName });
  await expect(row).toBeVisible();

  // 後始末: 作成した軸を削除する
  await row.getByRole("button", { name: "削除" }).click();
  await expect(page.getByRole("alertdialog", { name: "この分類を削除しますか?" })).toBeVisible();
  await page.getByRole("button", { name: "削除する" }).click();

  await expect(page.getByText("分類を削除しました")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: axisName })).toHaveCount(0);
});
