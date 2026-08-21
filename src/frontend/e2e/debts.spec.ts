import { expect, test } from "@playwright/test";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B11 負債入力画面のE2Eテスト(8/10本目)。
 *
 * 負債を1件追加して保存し、削除して保存し直すまでを確認する(分割計画コメント参照、
 * https://trello.com/c/O02SOfp3)。B11は1画面に全件をまとめて保存する作りで、
 * 「負債を追加」は行を増やすだけ・保存して初めて確定する(docs/screen-requirements-
 * dashboard.md B11「追加・削除と保存」)。**テストの最後に必ず削除して後始末する**。
 *
 * `DEBT_NAME_LABEL`/`DEBT_BALANCE_LABEL`は行ごとに同じ文言のため、既存の負債が
 * 何件あってもロケータが一意になるよう、`append`が末尾に行を追加する実装
 * (`useFieldArray`)に合わせて常に`.last()`で対象行を選ぶ。
 *
 * ログインは1回だけ行い(storageState共有ヘルパーはまだ使わない — 4本目のPRが
 * 未マージのため、5〜7本目と同じ理由)。
 */

test("負債を追加・保存し、削除して保存し直せる", async ({ page }) => {
  const debtName = `E2Eテスト負債-${Date.now()}`;

  await loginWithTotp(page, getE2eTestAccount());
  await page.goto("/debts");

  // 行を追加(末尾に増える)して入力
  await page.getByRole("button", { name: "負債を追加" }).click();
  await page.getByLabel("項目名").last().fill(debtName);
  await page.getByLabel("残債(円)").last().fill("500000");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  // 新規追加のみの保存では削除確認ダイアログは出ない
  await expect(page.getByText("負債を保存しました")).toBeVisible();

  // 後始末: この負債を削除して保存し直す
  await page.getByLabel("項目名").last().waitFor();
  await expect(page.getByLabel("項目名").last()).toHaveValue(debtName);
  await page.getByRole("button", { name: "削除", exact: true }).last().click();
  await page.getByRole("button", { name: "保存", exact: true }).click();

  // 既存負債を削除する保存なので、確認ダイアログを経る
  await expect(
    page.getByRole("alertdialog", { name: "負債1件を削除して保存しますか?" }),
  ).toBeVisible();
  await expect(page.getByText(`${debtName}(残債 ¥ 500,000)`)).toBeVisible();
  await page.getByRole("button", { name: "削除して保存する" }).click();

  await expect(page.getByText("負債を保存しました")).toBeVisible();
  await expect(page.getByText(debtName)).toHaveCount(0);
});
