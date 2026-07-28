import { FirebaseError } from "firebase/app";
import { TotpMultiFactorGenerator, multiFactor, reload } from "firebase/auth";

import {
  TOTP_FACTOR_DISPLAY_NAME,
  TOTP_ISSUER,
  TOTP_SECRET_KEY_GROUP_SIZE,
} from "@/constants/auth";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

import type { Auth, TotpSecret, User } from "firebase/auth";

/** セッションが失われたと見なすFirebaseのエラーコード */
const SESSION_LOST_ERROR_CODES = ["auth/user-token-expired", "auth/user-not-found"];

const isSessionLost = (error: unknown): boolean =>
  error instanceof FirebaseError && SESSION_LOST_ERROR_CODES.includes(error.code);

/** リクエストがFirebaseに届かなかったか。ローカルではAuthエミュレータ未起動が主な原因 */
const isNetworkError = (error: unknown): boolean =>
  error instanceof FirebaseError && error.code === "auth/network-request-failed";

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof FirebaseError && error.code === code;

/**
 * 永続化されたセッションの復元を待ってからAuthを返す。
 *
 * Firebase Authはセッションをブラウザ側(既定でIndexedDB)に持つため、初回描画の時点では
 * `currentUser`がまだnullのことがある。復元前の値で「セッション無し」と判断しないよう、必ずここを通す。
 */
const getReadyAuth = async (): Promise<Auth> => {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth;
};

/** TOTPの2要素目が既に登録されているか */
const hasEnrolledTotp = (user: User): boolean =>
  multiFactor(user).enrolledFactors.some(
    (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );

/**
 * 開始・検証で共通する失敗理由への変換。
 *
 * どちらの操作もIdentity Platformの多要素認証APIを叩くため、セッション・再認証・
 * プロジェクト設定に関する失敗は同じ形で返す。個別の失敗理由は呼び出し側で先に判定する。
 */
const toSharedFailureReason = (error: unknown): TotpEnrollmentStartFailureReason | undefined => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (isSessionLost(error)) {
    return "signed-out";
  }

  if (hasErrorCode(error, "auth/requires-recent-login")) {
    return "requires-recent-login";
  }

  if (hasErrorCode(error, "auth/unverified-email")) {
    return "email-unverified";
  }

  // 定数名は SECOND_FACTOR_ALREADY_ENROLLED だが、コード文字列は -in-use である
  if (hasErrorCode(error, "auth/second-factor-already-in-use")) {
    return "already-enrolled";
  }

  // Identity Platformへの未アップグレード、または多要素認証(TOTP)の未有効化。
  //
  // `auth/invalid-argument`もここに含める。TOTPの登録要求には利用者の入力が混ざらないため、
  // 引数が不正と返るのは受け側がTOTPの登録に対応していない場合に限られる。実際、Authエミュレータは
  // SMSの多要素認証しか実装しておらず、`Missing phoneEnrollmentInfo.`を添えてこのコードを返す。
  // 汎用の失敗として扱うと原因に辿り着けないので、有効化手順を案内する側に寄せる。
  if (
    hasErrorCode(error, "auth/operation-not-allowed") ||
    hasErrorCode(error, "auth/invalid-argument")
  ) {
    return "totp-not-enabled";
  }

  if (hasErrorCode(error, "auth/too-many-requests")) {
    return "too-many-requests";
  }

  if (isNetworkError(error)) {
    return "network-error";
  }

  return undefined;
};

/**
 * 手動入力用にシークレットキーを整形する(A3)。
 * 連続した文字列は書き写す際に読み違えやすいため、一定文字数ごとに空白で区切る。
 */
export const formatTotpSecretKey = (secretKey: string): string =>
  secretKey.match(new RegExp(`.{1,${TOTP_SECRET_KEY_GROUP_SIZE}}`, "g"))?.join(" ") ?? secretKey;

/**
 * TOTPの登録を開始し、QRコードと手動入力用シークレットキーの元になるシークレットを発行する(A3)。
 *
 * 発行されたシークレットはFirebase側で保留中の登録セッションと結び付いており、
 * 検証時に同じものを渡す必要がある。そのため画面側で保持できるようそのまま返す。
 */
export const startTotpEnrollment = async (): Promise<TotpEnrollmentStartResult> => {
  try {
    const auth = await getReadyAuth();
    const user = auth.currentUser;

    if (user === null) {
      return { ok: false, reason: "signed-out" };
    }

    // A2から自動で進んできた場合でもローカルの`emailVerified`が古いことがあるため取り直す
    await reload(user);

    if (!user.emailVerified) {
      return { ok: false, reason: "email-unverified" };
    }

    if (hasEnrolledTotp(user)) {
      return { ok: false, reason: "already-enrolled" };
    }

    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);

    return {
      ok: true,
      secret,
      qrCodeUrl: secret.generateQrCodeUrl(user.email ?? undefined, TOTP_ISSUER),
    };
  } catch (error) {
    const reason = toSharedFailureReason(error);
    if (reason !== undefined) {
      return { ok: false, reason };
    }

    console.error("2段階認証のQRコードを生成できませんでした", error);
    return { ok: false, reason: "unknown" };
  }
};

/**
 * 認証アプリの確認コードを検証し、TOTPの2要素目を有効化する(A3「確認する」)。
 *
 * `secret`は`startTotpEnrollment`が返したものをそのまま渡す。別のシークレットや
 * 期限切れのシークレットを渡すとFirebase側で拒否される。
 */
export const completeTotpEnrollment = async (
  secret: TotpSecret,
  verificationCode: string,
): Promise<TotpEnrollmentResult> => {
  try {
    const auth = await getReadyAuth();
    const user = auth.currentUser;

    if (user === null) {
      return { ok: false, reason: "signed-out" };
    }

    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
    await multiFactor(user).enroll(assertion, TOTP_FACTOR_DISPLAY_NAME);

    return { ok: true };
  } catch (error) {
    if (hasErrorCode(error, "auth/invalid-verification-code")) {
      return { ok: false, reason: "invalid-verification-code" };
    }

    // 保留中の登録セッションの期限切れ(`TotpSecret.enrollmentCompletionDeadline`超過)は、
    // 専用のエラーコードを特定できていないため個別には判定しない。確認コードの誤り以外の失敗は
    // まとめて`unknown`に落ち、画面側がQRコードの再取得を促すようにしてある。
    const reason = toSharedFailureReason(error);
    // 検証時のメール未確認はA2へ戻す理由にならない(登録開始時点で確認済みのため)
    if (reason !== undefined && reason !== "email-unverified") {
      return { ok: false, reason };
    }

    console.error("2段階認証を設定できませんでした", error);
    return { ok: false, reason: "unknown" };
  }
};
