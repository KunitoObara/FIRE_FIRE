/**
 * E2Eテスト専用アカウントの資格情報。
 *
 * `.env.local`に置く(コミットしない。ルートの`.gitignore`と`src/frontend/.gitignore`の
 * `.env*`除外を踏襲)。値そのものは[X18]の設計方針1・2のとおり、開発者本人のアカウントとは
 * 別に用意したテスト専用アカウントのもの。
 *
 * - `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`: A1でサインアップ済み・A2でメール確認済みのアカウント
 * - `E2E_TEST_TOTP_SECRET`: A3のTOTP登録で発行されたシークレットキー(Base32、スペース抜き)。
 *   `formatTotpSecretKey`が画面に表示する値からスペースを除いたもの
 */
export type E2eTestAccount = {
  email: string;
  password: string;
  totpSecret: string;
};

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env.local に追加してください([X18] 実装タスク参照)。`,
    );
  }

  return value;
};

export const getE2eTestAccount = (): E2eTestAccount => ({
  email: readRequiredEnv("E2E_TEST_EMAIL"),
  password: readRequiredEnv("E2E_TEST_PASSWORD"),
  // シークレットはスペース・ハイフンを含んだまま貼られることがあるため、生成側で正規化する
  totpSecret: readRequiredEnv("E2E_TEST_TOTP_SECRET"),
});
