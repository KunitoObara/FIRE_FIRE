import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { z } from "zod";

import { verifyPassword } from "../auth/verify-password";
import {
  createRecoveryCodeHash,
  createRecoveryCodes,
  isRecoveryCodeFormat,
  normalizeRecoveryCode,
} from "./recovery-code";
import { consumeRecoveryCode, getRecoveryCodeStatus, replaceRecoveryCodes } from "./store";

import type { UserRecord } from "firebase-admin/auth";

/**
 * 2FAリカバリーコードのCloud Functions(docs/auth-login-requirements.md 3.3)。
 *
 * - `generateMfaRecoveryCodes`: A3の2FA登録完了時とB10の再発行で呼ぶ。平文はここでしか返らない
 * - `getMfaRecoveryCodeStatus`: B10で残り本数を表示するために呼ぶ
 * - `useMfaRecoveryCode`: A5で認証アプリを失ったときに呼ぶ。コードを1本消費してTOTP登録を解除し、
 *   ユーザーをA3の再登録へ戻す
 *
 * 追加のロック機構は持たない(docs/auth-login-requirements.md 3.7)。効く防御は相手によって違う。
 *
 * - パスワードを知らない相手: `useMfaRecoveryCode`はコードの照合より先にパスワードを
 *   Identity Platformへ問い合わせるため、そのレート制限で試行そのものが止まる
 * - パスワードを知っている相手(漏洩後の2FA迂回): 上記のレート制限は当てにできない。
 *   コードの総当たりは40ビットの探索空間と、1回の照合につき未使用コードの本数(最大8)ぶん
 *   かかるscryptのコストで抑える。1本を引き当てるまでに必要な試行回数は、
 *   この呼び出し単価では現実的な時間・費用に収まらない
 */

/**
 * Identity PlatformのWeb APIキー。パスワードの再検証(`verify-password.ts`)に使う。
 *
 * 公開値ではあるが、CIからの非対話デプロイでも確実に解決できる置き場が要るためSecret Managerに置く
 * (`.env`系ファイルはリポジトリで除外している)。設定手順は docs/ci-cd-setup.md を参照。
 * Authエミュレータに向いている間はダミーキーで動くため、ローカル開発では未設定でよい。
 */
const IDENTITY_PLATFORM_WEB_API_KEY = defineSecret("IDENTITY_PLATFORM_WEB_API_KEY");

const useMfaRecoveryCodeInputSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  recoveryCode: z.string().min(1),
});

/**
 * 画面が出し分けに使う失敗理由。
 *
 * `HttpsError`のメッセージは画面にそのまま出さないため、機械可読な理由を`details`に載せる
 * (フロントエンド側の対応は`src/frontend/src/lib/auth/mfa-recovery.ts`)。
 */
type RecoveryFailureReason =
  | "unauthenticated"
  | "email-unverified"
  | "mfa-not-enrolled"
  | "invalid-credential"
  | "invalid-recovery-code"
  | "no-recovery-codes"
  | "too-many-requests"
  /** コードは消費したが2FAを解除できなかった。他の失敗と違い、使ったコードが戻らない */
  | "unenroll-failed"
  | "unavailable";

const failure = (
  code: "unauthenticated" | "failed-precondition" | "permission-denied" | "unavailable",
  reason: RecoveryFailureReason,
  message: string,
): HttpsError => new HttpsError(code, message, { reason });

/** 2FA(TOTP)が登録済みか。本アプリが登録する2要素目はTOTPだけ(3.3) */
const hasEnrolledFactor = (user: UserRecord): boolean =>
  (user.multiFactor?.enrolledFactors.length ?? 0) > 0;

/**
 * リカバリーコードを発行して平文を返す(A3の2FA登録完了時・B10の再発行)。
 *
 * 平文を返すのはこの応答の一度だけで、Firestoreにはハッシュしか残らない。
 * 既存のコードは無効になる(`replaceRecoveryCodes`)。
 */
export const generateMfaRecoveryCodes = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (uid === undefined) {
    throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
  }

  const user = await getAuth().getUser(uid);

  // A3は「メール確認済み」「2FA登録済み」を満たした状態から呼ぶ。IDトークンの内容ではなく
  // Admin SDKで取得した現在の状態で確かめる(登録直後のトークンには反映されていないため)
  if (!user.emailVerified) {
    throw failure("failed-precondition", "email-unverified", "メールアドレスの確認が必要です");
  }

  if (!hasEnrolledFactor(user)) {
    throw failure("failed-precondition", "mfa-not-enrolled", "2段階認証の登録が必要です");
  }

  const codes = createRecoveryCodes();
  await replaceRecoveryCodes(uid, await Promise.all(codes.map(createRecoveryCodeHash)));

  return { codes };
});

/**
 * リカバリーコードの発行状況を返す(B10の表示用)。
 *
 * 平文もハッシュも返さない。クライアントはFirestoreのこの領域を読めないため
 * (`firestore.rules`)、残り本数はここを通して渡す。
 */
export const getMfaRecoveryCodeStatus = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (uid === undefined) {
    throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
  }

  return getRecoveryCodeStatus(uid);
});

/**
 * リカバリーコードで2FA(TOTP)の登録を解除する(A5「リカバリーコードを使う」)。
 *
 * サインイン自体はここで成立させない。Identity PlatformはTOTPの確認コード以外で
 * 2要素目の検証を完了できず、カスタムトークンで代替するとMFAを通らない経路を常設することになる。
 * 認証アプリを失った状況では再登録が必要なので、解除だけを行い、
 * 呼び出し元は通常のログインをやり直してA3へ進む(docs/screen-requirements-auth.md A5)。
 *
 * 一次認証の通過はパスワードの再検証で確かめる。呼び出し時点でクライアントはサインインしておらず、
 * IDトークンによる本人確認ができないため。
 */
export const useMfaRecoveryCode = onCall(
  { secrets: [IDENTITY_PLATFORM_WEB_API_KEY] },
  async (request) => {
    const input = useMfaRecoveryCodeInputSchema.safeParse(request.data);

    if (!input.success) {
      throw new HttpsError("invalid-argument", "リクエストの形式が正しくありません");
    }

    const { email, password, recoveryCode } = input.data;
    const normalizedCode = normalizeRecoveryCode(recoveryCode);

    // 形式から外れた入力はパスワードの照合にも進まない。上流のレート制限を無駄に消費しないため
    if (!isRecoveryCodeFormat(normalizedCode)) {
      throw failure(
        "permission-denied",
        "invalid-recovery-code",
        "リカバリーコードが正しくありません",
      );
    }

    const verification = await verifyPassword(IDENTITY_PLATFORM_WEB_API_KEY.value(), email, password);

    switch (verification.status) {
      case "mfa-required":
        break;
      case "signed-in":
        // パスワードは正しいが2FAが登録されていない。解除するものが無く、
        // 通常のログインでそのまま進めるためリカバリーコードは消費しない
        throw failure("failed-precondition", "mfa-not-enrolled", "2段階認証が登録されていません");
      case "invalid-credential":
        throw failure(
          "permission-denied",
          "invalid-credential",
          "メールアドレスまたはパスワードが正しくありません",
        );
      case "too-many-requests":
        throw failure("permission-denied", "too-many-requests", "試行回数が多すぎます");
      default:
        throw failure("unavailable", "unavailable", "認証基盤に接続できませんでした");
    }

    const user = await getAuth().getUserByEmail(email);

    if (!hasEnrolledFactor(user)) {
      throw failure("failed-precondition", "mfa-not-enrolled", "2段階認証が登録されていません");
    }

    const consumed = await consumeRecoveryCode(user.uid, normalizedCode);

    if (consumed.status === "no-codes") {
      throw failure(
        "failed-precondition",
        "no-recovery-codes",
        "利用できるリカバリーコードがありません",
      );
    }

    if (consumed.status === "no-match") {
      throw failure(
        "permission-denied",
        "invalid-recovery-code",
        "リカバリーコードが正しくありません",
      );
    }

    // 解除の前にコードを使用済みにしている。解除に失敗した場合コードは1本失われるが、
    // 逆順にすると解除済みなのに有効なままのコードが残り、1回限りの前提が崩れる。
    // 消費したコードは戻さず、残っているコードでの再試行を画面から促す
    try {
      await getAuth().updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
    } catch (error) {
      console.error("2段階認証の登録を解除できませんでした", error);
      throw failure("unavailable", "unenroll-failed", "2段階認証を解除できませんでした");
    }

    return { remainingCodes: consumed.remainingCodes };
  },
);
