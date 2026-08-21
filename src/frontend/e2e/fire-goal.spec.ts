import { expect, test } from "@playwright/test";
import path from "node:path";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B8 FIRE目標設定・B9 想定利回り・リスク設定のE2Eテスト(9/10本目)。
 *
 * どちらも上書き型の単一設定画面(`users/{uid}/settings/fireGoal`・`settings/assumptions`)
 * で、何度保存し直しても副作用が蓄積しない。分割計画コメント(https://trello.com/c/O02SOfp3)
 * のとおり後始末は不要。
 *
 * B8の「毎月の積立額」は前月の収支から初期値を提示することがあるが、値は実行時点の
 * 日付とfixtureのCSVの日付関係に依存し不安定なため、提示された値をアテにせず必ず
 * 明示した値で上書きする。
 *
 * B9は直近の資産残高が無いと編集対象の行が無い(「データがありません」)。他のスライスの
 * 実行順に依存させないため、このテストの中で[X18]のfixture CSV(資産残高推移)を
 * 自己完結で取り込んでから一覧を開く(日付キーのため再取込は上書きになるだけで安全、
 * csv-import.spec.tsと同じ理由)。
 *
 * ログインは1回だけ行い(storageState共有ヘルパーはまだ使わない — 4本目のPRが
 * 未マージのため、5〜8本目と同じ理由)。
 */

const ASSET_BALANCE_CSV = path.join(__dirname, "fixtures", "asset-balance-sample.csv");

test("B8: 目標資産額と毎月の積立額を保存できる", async ({ page }) => {
  await loginWithTotp(page, getE2eTestAccount());
  await page.goto("/fire-goal");

  await page.getByRole("tab", { name: "直接入力" }).click();
  await page.getByLabel("目標資産額(円)").fill("50000000");
  await page.getByLabel("毎月の積立額(円)").fill("30000");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("FIRE目標を保存しました")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("B9: 資産種別の想定利回り・リスクレベルを保存できる", async ({ page }) => {
  await loginWithTotp(page, getE2eTestAccount());

  // 編集対象の行を保証するため、自己完結でfixtureの資産残高推移を取り込んでおく。
  // CsvImportScreen.tsxは取込種別タブをforceMountで常時両方マウントしており、非表示側も
  // CSSで隠れているだけでDOMには残る(input自身がCsvDropzone.tsxで常にdisplay:noneのため
  // `:visible`フィルタでも絞り込めない)。`getByRole`は非表示側を正しく除外するため、
  // アクティブな`tabpanel`にスコープしてから探す
  await page.goto("/csv-import");
  await page.getByRole("tabpanel").getByLabel("CSVファイル").setInputFiles(ASSET_BALANCE_CSV);
  await page.getByRole("button", { name: "取込を実行する" }).click();
  await expect(page.getByText(/取込が完了しました/)).toBeVisible();

  await page.goto("/assumptions");
  await page.getByLabel("預金・現金の想定利回り(年率%)").fill("1");
  await page.getByLabel("預金・現金のリスクレベル").click();
  await page.getByRole("option", { name: "低" }).click();
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("想定利回り・リスクを保存しました")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});
