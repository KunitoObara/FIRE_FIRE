/**
 * Identity Platformに対するパスワードの再検証。
 *
 * リカバリーコードによる2FA解除(A5)では、呼び出し元がまだサインインしていない。
 * 2FA登録済みのアカウントは確認コードを出すまでサインインが完了せず、IDトークンを取れないため、
 * 「一次認証を通過している」ことをサーバー側で確かめる手段が他に無い。
 * Admin SDKにパスワード照合のAPIは無いので、Identity PlatformのREST APIを直接叩く。
 *
 * ここで受け取ったパスワードは検証に使うだけで、保存もログ出力もしない。
 */

/** パスワード照合の結果。Identity Platform側のエラーコードを呼び出し元に持ち込まないための境界 */
export type PasswordVerificationResult =
  /** パスワードは正しく、2FAの確認コード待ちになった(=2FA登録済み) */
  | { status: "mfa-required" }
  /** パスワードは正しいが2FAが登録されておらず、そのままサインインが成立した */
  | { status: "signed-in" }
  /** メールアドレスかパスワードが誤り(どちらかは区別しない)、またはアカウントが無効化されている */
  | { status: "invalid-credential" }
  /** Identity Platform側のレート制限に当たった(docs/auth-login-requirements.md 3.7) */
  | { status: "too-many-requests" }
  /** 上流に到達できない・想定外の応答 */
  | { status: "unavailable" };

/**
 * 資格情報の誤りとして扱うIdentity Platformのエラーコード。
 *
 * `USER_DISABLED`も同じ扱いにする。A4の表示方針(docs/screen-requirements-auth.md A4)と揃え、
 * アカウントの状態を外部から判定できる情報を返さないため。
 */
const INVALID_CREDENTIAL_ERROR_CODES = [
  "EMAIL_NOT_FOUND",
  "INVALID_PASSWORD",
  "INVALID_LOGIN_CREDENTIALS",
  "INVALID_EMAIL",
  "MISSING_PASSWORD",
  "USER_DISABLED",
];

const TOO_MANY_ATTEMPTS_ERROR_CODE = "TOO_MANY_ATTEMPTS_TRY_LATER";

/**
 * エミュレータ利用時にIdentity Platformの代わりに使うAPIキー。
 *
 * Authエミュレータはキーを検証しないため、ローカル開発では
 * Secret Manager(`IDENTITY_PLATFORM_WEB_API_KEY`)の設定を要らなくする。
 */
const EMULATOR_API_KEY = "fake-api-key";

/** `accounts:signInWithPassword`の応答のうち、判定に使う項目だけを見る */
type SignInWithPasswordResponse = {
  /** 2FA登録済みの場合に返る確認コード待ちの資格情報。存在自体を「2FAが必要」の合図として使う */
  mfaPendingCredential?: string;
  error?: { message?: string };
};

const requestUrl = (apiKey: string): string => {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const origin =
    emulatorHost === undefined
      ? "https://identitytoolkit.googleapis.com"
      : `http://${emulatorHost}/identitytoolkit.googleapis.com`;
  const key = emulatorHost === undefined ? apiKey : EMULATOR_API_KEY;

  return `${origin}/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`;
};

/**
 * メールアドレスとパスワードでIdentity Platformにサインインを試み、通ったかどうかだけを返す。
 *
 * 2FA登録済みのアカウントではサインインは完了せず`mfaPendingCredential`が返る。これは失敗ではなく
 * 「パスワードは正しい」ことの証明として使う(A4のクライアント側と同じ挙動)。
 *
 * `apiKey`はWeb APIキー(フロントエンドのビルドにも含まれる公開値)。クライアントから
 * 受け取らずサーバー側の設定値を使う。別プロジェクトのキーを渡されると、そのプロジェクトで
 * 通ったパスワードを本プロジェクトの一次認証の通過と誤認してしまうため。
 */
export const verifyPassword = async (
  apiKey: string,
  email: string,
  password: string,
): Promise<PasswordVerificationResult> => {
  let response: Response;

  try {
    response = await fetch(requestUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // トークンは使わないが、`returnSecureToken`を省いた場合の挙動は保証されていないため
      // 通常のサインインと同じ形で要求する。応答のトークンはこの関数の外に出さない
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  } catch (error) {
    console.error("Identity Platformへの接続に失敗しました", error);
    return { status: "unavailable" };
  }

  let body: SignInWithPasswordResponse;
  try {
    body = (await response.json()) as SignInWithPasswordResponse;
  } catch (error) {
    console.error("Identity Platformの応答を解釈できませんでした", response.status, error);
    return { status: "unavailable" };
  }

  if (response.ok) {
    return body.mfaPendingCredential === undefined
      ? { status: "signed-in" }
      : { status: "mfa-required" };
  }

  // エラーコードは`TOO_MANY_ATTEMPTS_TRY_LATER : ...`のように補足が続く場合がある
  const errorCode = (body.error?.message ?? "").split(":")[0].trim();

  if (INVALID_CREDENTIAL_ERROR_CODES.includes(errorCode)) {
    return { status: "invalid-credential" };
  }

  if (errorCode === TOO_MANY_ATTEMPTS_ERROR_CODE) {
    return { status: "too-many-requests" };
  }

  // パスワードは含まれないため、切り分け用にエラーコードだけ残す
  console.error("パスワードを検証できませんでした", response.status, errorCode);
  return { status: "unavailable" };
};
