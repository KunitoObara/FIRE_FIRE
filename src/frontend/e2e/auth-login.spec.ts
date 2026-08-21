import { expect, test } from "@playwright/test";

import {
  getE2eNoTotpTestAccount,
  getE2eTestAccount,
  getE2eUnverifiedTestAccount,
} from "./helpers/env";

/**
 * [X19] A4ログイン失敗系・A6/A7パスワードリセット申請のE2Eテスト(3/10本目)。
 *
 * `smoke.spec.ts`([X18])がログイン成功の疎通(A4→A5→B1)を既にカバーしているため、ここでは
 * 重複させず**失敗系・分岐先**に絞る。`LoginForm.test.tsx`(RTL)は`signInWithEmail`自体を
 * モックしており、実際のFirebase Authが返すエラー形状・分岐条件までは確認できない
 * ([A1]で見つかった不具合(https://trello.com/c/idgZRaS3)と同種の、実結線の欠落があり得る箇所)。
 *
 * **A7の「実際にoobCodeでパスワードを再設定する」パスは対象外。** リセットメールの受信は
 * A2のメール確認・A8のGoogle OAuthと同じ「繰り返し実行できない外部依存」(受信箱を開いて
 * リンクをコピーする手動操作が要る)。ここではoobCodeが無い/無効なリンクを開いたときの
 * エラー表示までを確認する(これは実際のoobCodeを必要とせず、何度実行しても副作用が無い)。
 *
 * **A4のメール未確認→A2・TOTP未登録→A3の2テストは、固定フィクスチャアカウントが必要**
 * (状態が変化しないため繰り返し利用できるが、事前の手動セットアップが要る。E2E_TEST_EMAILと
 * 同様、signupAllowlistへの登録はクライアントから書けないため)。未設定の間は`test.skip`で
 * 見送り、セットアップ後に自動で有効になる。
 */

test("誤ったパスワードでのログインは、実際のバックエンド拒否メッセージを表示し画面に留まる", async ({
  page,
}) => {
  // レート制限への配慮(X18の設計方針3)から、実際のFirebase呼び出しは1回に絞る。
  // 「存在しないメールアドレス」も同じ`invalid-credential`に丸められる実装(sign-in.ts)なので
  // 別途テストしない
  const account = getE2eTestAccount();

  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(`${account.password}-wrong`);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page.getByText("メールアドレスまたはパスワードが正しくありません。")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("「アカウントをお持ちでない方」からA1へ遷移できる", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("link", { name: "サインアップ", exact: true }).click();

  await expect(page).toHaveURL(/\/signup$/);
});

test("メール未確認のアカウントでログイン試行するとA2へ誘導される", async ({ page }) => {
  const account = getE2eUnverifiedTestAccount();
  test.skip(
    account === null,
    "E2E_TEST_UNVERIFIED_EMAIL/PASSWORDが未設定のため見送り(要セットアップ、Trelloカード[X19]参照)",
  );
  if (account === null) {
    return;
  }

  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByText(account.email)).toBeVisible();
});

test("メール確認済みで2FA未登録のアカウントでログイン試行するとA3へ誘導される", async ({
  page,
}) => {
  const account = getE2eNoTotpTestAccount();
  test.skip(
    account === null,
    "E2E_TEST_NO_TOTP_EMAIL/PASSWORDが未設定のため見送り(要セットアップ、Trelloカード[X19]参照)",
  );
  if (account === null) {
    return;
  }

  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page).toHaveURL(/\/mfa-setup$/);
});

test("A6でリセットメールの送信を申請すると、未登録アドレスでも同一の完了メッセージを表示する", async ({
  page,
}) => {
  await page.goto("/forgot-password");

  // 実在しない架空のアドレス。アカウントの存在有無を伏せる仕様上、これでも完了メッセージになる
  await page.locator("#email").fill(`e2e-forgot-password-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "リセットメールを送信する" }).click();

  await expect(
    page.getByText(
      "入力されたメールアドレス宛にパスワード再設定用のメールを送信しました。メールに記載のリンクから手続きを進めてください。",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "別のメールアドレスで送り直す" }).click();
  await expect(page.locator("#email")).toBeVisible();

  await page.getByRole("link", { name: "ログインに戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("A7にoobCode無しで到達すると、無効なリンクのエラーとA6への導線を表示する", async ({
  page,
}) => {
  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { name: "リンクの有効期限が切れています" })).toBeVisible();
  await expect(
    page.getByText(
      "このパスワード再設定リンクは無効か、有効期限が切れています。お手数ですが再度リセットメールをリクエストしてください。",
    ),
  ).toBeVisible();

  await page.getByRole("link", { name: "パスワードをお忘れの方へ戻る" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
