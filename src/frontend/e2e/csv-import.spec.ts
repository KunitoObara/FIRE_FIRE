import { expect, test } from "@playwright/test";
import path from "node:path";

import { loginWithTotp } from "./helpers/auth";
import { getE2eTestAccount } from "./helpers/env";

/**
 * [X19] B2 CSV取込・B3 収支明細一覧のE2Eテスト(5/10本目)。
 *
 * [X18]のfixture CSV(`e2e/fixtures/`)を使う。資産残高推移は日付キー、入出金明細は
 * マネーフォワードの取引IDキーで、どちらも同じファイルの再取込は上書きになるだけで
 * 増え続けない(docs/transaction-import-requirements.md)。何度実行しても副作用が
 * 蓄積しないため、E2E_TEST_EMAILへの取込を繰り返しても安全。
 *
 * ログインは1回だけ行い(このファイルはテストが1本のみのため、[4本目]で新設した
 * storageState共有ヘルパーは使わない — そちらは4本目のPRがまだ未マージで、
 * このブランチのauth.tsには無い。次にdevelopを引き直すタイミングで揃える)。
 *
 * プレビューの「新規/上書き」件数は、このアカウントへの過去の取込回数によって変わる
 * ため断定しない。合計件数(ファイルの行数どおりで安定)だけを確認する。
 */

const ASSET_BALANCE_CSV = path.join(__dirname, "fixtures", "asset-balance-sample.csv");
const TRANSACTIONS_CSV = path.join(__dirname, "fixtures", "transactions-sample.csv");

test("資産残高推移・入出金明細のCSVを取り込み、B3に反映される", async ({ page }) => {
  await loginWithTotp(page, getE2eTestAccount());

  await page.goto("/csv-import");

  // 資産残高推移(既定タブ、5行)
  await page.getByLabel("CSVファイル").setInputFiles(ASSET_BALANCE_CSV);
  await expect(page.getByText("取込対象: 5件")).toBeVisible();
  await page.getByRole("button", { name: "取込を実行する" }).click();
  await expect(page.getByText(/取込が完了しました/)).toBeVisible();

  // 入出金明細タブへ切替(9行)
  await page.getByRole("tab", { name: "入出金明細" }).click();
  await page.getByLabel("CSVファイル").setInputFiles(TRANSACTIONS_CSV);
  await expect(page.getByText("取込対象: 9件")).toBeVisible();
  await page.getByRole("button", { name: "取込を実行する" }).click();
  await expect(page.getByText(/取込が完了しました/)).toBeVisible();

  // B3: 既定の「直近1ヶ月」だとfixtureの日付(2026年6〜7月)が範囲外になりうるため、
  // 「全期間」に切り替えてから確認する
  await page.goto("/transactions");
  await page.getByLabel("期間").click();
  await page.getByRole("option", { name: "全期間" }).click();
  await page.getByRole("button", { name: "絞り込む" }).click();

  await expect(page.getByText("スーパー〇〇").first()).toBeVisible();
  await expect(page.getByText("給与").first()).toBeVisible();
});
