import { FirebaseError } from "firebase/app";
import { TotpMultiFactorGenerator, setPersistence } from "firebase/auth";

import { persistenceFor } from "@/lib/auth/session-persistence";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

/** 検証セッション(A4で受け取ったresolver)が既に使えないことを示すFirebaseのエラーコード */
const SESSION_EXPIRED_ERROR_CODES = [
  "auth/invalid-multi-factor-session",
  "auth/missing-multi-factor-session",
];

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof FirebaseError && error.code === code;

const toFailureReason = (error: unknown): MfaVerificationFailureReason | undefined => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (hasErrorCode(error, "auth/invalid-verification-code")) {
    return "invalid-verification-code";
  }

  if (error instanceof FirebaseError && SESSION_EXPIRED_ERROR_CODES.includes(error.code)) {
    return "session-expired";
  }

  if (hasErrorCode(error, "auth/too-many-requests")) {
    return "too-many-requests";
  }

  // ローカル開発ではAuthエミュレータ未起動が主な原因になる
  if (hasErrorCode(error, "auth/network-request-failed")) {
    return "network-error";
  }

  return undefined;
};

/**
 * 一次認証を通過したログインを、認証アプリの確認コードで完了させる(A5「検証する」)。
 *
 * `login`はA4が預けた`PendingLogin`をそのまま渡す。resolverはFirebaseが発行した
 * 検証セッションそのもので、これ以外から二次認証を完了させる手段はない。
 *
 * 確認コードが誤っていてもresolverは無効にならないため、呼び出し側は同じ`login`で再試行できる。
 */
export const verifyTotpForSignIn = async (
  login: PendingLogin,
  verificationCode: string,
): Promise<MfaVerificationResult> => {
  try {
    // 登録済みの2要素目の識別子。本アプリが登録するのはTOTPだけ(docs/auth-login-requirements.md 3.3)
    // のため通常は必ず見つかる。見つからないのは想定外の状態なので、専用の理由は設けず`unknown`に落とす
    const totpHint = login.resolver.hints.find(
      (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    );

    if (totpHint === undefined) {
      // 切り分けに要るのは「何が登録されているか」だけなので、hintsをそのまま出さずに
      // factorIdの一覧に絞る(hintには2要素目のuidが含まれるため)
      console.error(
        "TOTPの2要素目が登録されていません",
        login.resolver.hints.map((hint) => hint.factorId),
      );
      return { ok: false, reason: "unknown" };
    }

    // セッションが実際に作られるのはこの直後の`resolveSignIn`のため、
    // A4での指定に頼らず「ログイン状態を保持する」の選択をここで適用し直す
    await setPersistence(getFirebaseAuth(), persistenceFor(login.rememberMe));

    const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, verificationCode);
    await login.resolver.resolveSignIn(assertion);

    return { ok: true };
  } catch (error) {
    const reason = toFailureReason(error);
    if (reason !== undefined) {
      return { ok: false, reason };
    }

    console.error("確認コードを検証できませんでした", error);
    return { ok: false, reason: "unknown" };
  }
};
