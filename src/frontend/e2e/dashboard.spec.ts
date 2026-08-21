import { expect, test } from "@playwright/test";

import { getAuthStateFilePath, saveLoggedInStorageState } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B1 ダッシュボード画面のE2Eテスト(4/10本目)。
 *
 * **分類軸切替・月選択の実インタラクションは今回対象外**(分割計画コメント参照、
 * https://trello.com/c/O02SOfp3)。`docs/screen-requirements-dashboard.md`「資産残高が
 * 1件も無いときの空状態は切替によらず同じとする(切替を出す前に空状態を出す)」のとおり、
 * `E2E_TEST_EMAIL`にはまだCSV取込・分類軸データが無く(5本目B2・6本目B4で用意する予定)、
 * 切り替える対象そのものが無い。
 *
 * ここで自動化するのは、**ログイン直後の空状態表示**。各ウィジェットが実際に空の
 * Firestoreに対して正しい空状態(文言・導線)を返すことと、そこからのCTA遷移
 * (→B2/B4/B8/B11)を確認する。RTL(`DashboardScreen.test.tsx`)はこの部分をモックした
 * データで検証しており、実際に何も取り込んでいないアカウントに対する実結線の確認では
 * ない。
 *
 * ログインはfile内で1回だけ行い(`beforeAll` + `storageState`)、テストごとに
 * 実サインインし直さない。Identity Platformのレート制限への配慮([X18]の設計方針3)。
 */

const STORAGE_STATE_FILE_NAME = "dashboard.json";

test.beforeAll(async ({ browser }) => {
  await saveLoggedInStorageState(browser, getE2eTestAccount(), STORAGE_STATE_FILE_NAME);
});

test.use({ storageState: getAuthStateFilePath(STORAGE_STATE_FILE_NAME) });

test("資産分類軸が未登録のとき、資産の表示は空状態を出しB4への導線を持つ", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("資産の表示")).toBeVisible();
  await expect(
    page.getByText("分類軸が登録されていません。資産分類マスタで分類軸を追加してください。"),
  ).toBeVisible();

  await page.getByRole("link", { name: "資産分類を設定する" }).click();
  await expect(page).toHaveURL(/\/asset-categories$/);
});

test("FIRE目標が未設定のとき、FIRE達成度は空状態を出しB8への導線を持つ", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("FIRE達成度")).toBeVisible();
  await expect(
    page.getByText("FIRE目標が未設定です。目標を設定すると達成度と到達予測日が表示されます。"),
  ).toBeVisible();

  // カード見出しのCardActionと空状態のボタン、2箇所に同じラベルの導線があるため`.first()`で選ぶ
  await page.getByRole("link", { name: "目標を設定する" }).first().click();
  await expect(page).toHaveURL(/\/fire-goal$/);
});

test("取引が無い月は収支サマリが空状態を出しB2への導線を持つ", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("収支サマリ")).toBeVisible();
  // 月名は実行時点の年月に依存するため、日付非依存の部分だけを照合する
  await expect(
    page.getByText(/の取引がありません。別の月を選ぶか、入出金明細CSVを取り込んでください。/),
  ).toBeVisible();

  await page.getByRole("link", { name: "CSVを取り込む" }).click();
  await expect(page).toHaveURL(/\/csv-import$/);
});

test("負債が未登録のとき、負債サマリは空状態を出しB11への導線を持つ", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("負債サマリ")).toBeVisible();
  await expect(
    page.getByText("負債がまだ登録されていません。登録するとここに残債が並びます。"),
  ).toBeVisible();

  await page.getByRole("link", { name: "負債を登録する" }).click();
  await expect(page).toHaveURL(/\/debts$/);
});
