import { expect, test } from "@playwright/test";

/**
 * [X19] 公開画面(A0・A9・A10・A11・A12)のE2Eテスト(1/10本目)。
 *
 * この5画面はログインを要求しない唯一の画面群(docs/screen-requirements-public.md 2章)なので、
 * X18のTOTPログインヘルパーを使わず、未ログインの新規ブラウザコンテキストでそのまま開ける。
 * Identity Platformのレート制限([X18]の設計方針3)にも掛からない — ここではサインイン自体を
 * 一度も行わないため。
 *
 * ここで見るのは実際のページ遷移・実際の未ログイン状態でのボタン出し分け・実際に配信される
 * `<meta name="robots">` など、RTL(`page.test.tsx`)では見えないもの。表示項目や文言の詳細は
 * 各`page.test.tsx`が既にカバーしているため重複しない(docs/screen-list-and-transitions.md
 * 3.4「公開画面の遷移」がこのファイルの一次情報源)。
 */

test("A0はタイトルとnoindexを持つ", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("FIRE-FIRE | 自分の資産を、自分の分類で数える。");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("A0のフッター:利用規約→A9、ヘッダーのロゴ→A0", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "規約" })
    .getByRole("link", { name: "利用規約" })
    .click();

  await expect(page).toHaveURL(/\/terms$/);
  await expect(page).toHaveTitle("利用規約 | FIRE-FIRE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByRole("link", { name: "FIRE-FIRE" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("A0のフッター:プライバシーポリシー→A10、ヘッダーのロゴ→A0", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "規約" })
    .getByRole("link", { name: "プライバシーポリシー" })
    .click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page).toHaveTitle("プライバシーポリシー | FIRE-FIRE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByRole("link", { name: "FIRE-FIRE" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("A0のフッター:ヘルプ→A12、ヘッダーのロゴ→A0", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "ヘルプ" }).click();

  await expect(page).toHaveURL(/\/help$/);
  await expect(page).toHaveTitle("ヘルプ | FIRE-FIRE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByRole("link", { name: "FIRE-FIRE" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("A0のフッター:お問い合わせ→A11、ヘッダーのロゴ→A0", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "お問い合わせ", exact: true }).click();

  await expect(page).toHaveURL(/\/contact$/);
  await expect(page).toHaveTitle("お問い合わせ | FIRE-FIRE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByRole("link", { name: "FIRE-FIRE" }).click();
  await expect(page).toHaveURL(/\/$/);
});

/**
 * フッターは5画面共通のため、A9・A10・A11・A12の間は互いに行き来できる
 * (docs/screen-list-and-transitions.md 3.4)。図が引くA9⇄A10の2本を確認する。
 */
test("A9とA10はフッターから互いに行き来できる", async ({ page }) => {
  await page.goto("/terms");

  await page
    .getByRole("navigation", { name: "規約" })
    .getByRole("link", { name: "プライバシーポリシー" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);

  await page
    .getByRole("navigation", { name: "規約" })
    .getByRole("link", { name: "利用規約" })
    .click();
  await expect(page).toHaveURL(/\/terms$/);
});

/**
 * A10「8. お問い合わせ先」本文中のリンク(フッターの「お問い合わせ」とは別のリンク、
 * ラベルも異なる)からA11へ遷移できることを確認する。
 */
test("A10本文のお問い合わせ先リンクからA11へ遷移できる", async ({ page }) => {
  await page.goto("/privacy");

  await page.getByRole("link", { name: "お問い合わせフォーム" }).click();

  await expect(page).toHaveURL(/\/contact$/);
});

/**
 * 未ログインのA0はヘッダーに「ログイン」「サインアップ」を出す(判定確定後)。
 * 実際のサインアップ・ログイン完了はそれぞれ別スライス(2本目・3本目)で扱うため、
 * ここでは遷移先の確認までに留める。
 */
test("未ログインのA0はヘッダーの「ログイン」「サインアップ」からA4・A1へ遷移できる", async ({
  page,
}) => {
  await page.goto("/");

  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "ログイン" })).toBeVisible();

  await header.getByRole("link", { name: "サインアップ" }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
