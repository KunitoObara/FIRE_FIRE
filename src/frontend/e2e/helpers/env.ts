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

/** メール/パスワードだけの固定アカウント。A4の一次認証後の分岐テストで使う([X19] 3本目) */
export type E2eCredentials = { email: string; password: string };

const readOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name];

  return value === undefined || value.trim() === "" ? undefined : value;
};

/**
 * 未設定のときは`null`を返す(`readRequiredEnv`と違い例外にしない)。
 *
 * 呼び出し側は`test.skip`でスキップする前提のヘルパーのため、ここで例外を投げると
 * スキップ判定の前にテストが落ちてしまう。
 */
const readOptionalCredentials = (emailVar: string, passwordVar: string): E2eCredentials | null => {
  const email = readOptionalEnv(emailVar);
  const password = readOptionalEnv(passwordVar);

  return email !== undefined && password !== undefined ? { email, password } : null;
};

/**
 * メール未確認のまま放置した固定アカウント(A1でサインアップ済み・A2のリンクは未クリック)。
 *
 * A4「メール未確認のアカウントでログイン試行→A2へ誘導」の実結線を確認するために使う。
 * 状態が変化しない(確認しない限りメール未確認のまま)ため、何度でも再利用できる。
 * signupAllowlistへの登録はクライアントから書けないため事前の手動セットアップが要る
 * (`docs/ci-cd-setup.md` 14章と同じ手順)。未設定の間、参照側のテストは`test.skip`で見送る。
 */
export const getE2eUnverifiedTestAccount = (): E2eCredentials | null =>
  readOptionalCredentials("E2E_TEST_UNVERIFIED_EMAIL", "E2E_TEST_UNVERIFIED_PASSWORD");

/**
 * メール確認済みだがTOTP未登録のまま放置した固定アカウント(A1〜A2完了・A3は未実施)。
 *
 * A4「2FA未登録のアカウントでログイン試行→A3へ誘導」の実結線を確認するために使う。
 * 上と同じ理由で未設定の間は`test.skip`で見送る。
 */
export const getE2eNoTotpTestAccount = (): E2eCredentials | null =>
  readOptionalCredentials("E2E_TEST_NO_TOTP_EMAIL", "E2E_TEST_NO_TOTP_PASSWORD");

/**
 * B10のアカウント削除テスト専用の、使い捨てアカウント(A1〜A3まで完了・TOTP登録済み)。
 *
 * 削除は取り消せないため、E2E_TEST_EMAIL(他の全specが共有するアカウント)を使うわけには
 * いかない。このアカウントは**実行するたびに実際に削除される**ので、テストを1回実行する
 * たびに新しいアカウントを用意し直す必要がある(分割計画コメント参照、
 * https://trello.com/c/O02SOfp3)。未設定の間は`test.skip`で見送る。
 */
export const getE2eDisposableTestAccount = (): E2eTestAccount | null => {
  const email = readOptionalEnv("E2E_TEST_DISPOSABLE_EMAIL");
  const password = readOptionalEnv("E2E_TEST_DISPOSABLE_PASSWORD");
  const totpSecret = readOptionalEnv("E2E_TEST_DISPOSABLE_TOTP_SECRET");

  return email !== undefined && password !== undefined && totpSecret !== undefined
    ? { email, password, totpSecret }
    : null;
};
