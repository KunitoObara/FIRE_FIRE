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
import {
  consumeRecoveryCode,
  deleteRecoveryCodes,
  getRecoveryCodeStatus,
  replaceRecoveryCodes,
} from "./store";

import type { RecoveryCodeStatus } from "./store";
import type { MultiFactorInfo, UserRecord } from "firebase-admin/auth";

/**
 * 2FAリカバリーコードのCloud Functions(docs/auth-login-requirements.md 3.3)。
 *
 * - `generateMfaRecoveryCodes`: A3の2FA登録完了時とB10の再発行で呼ぶ。平文はここでしか返らない
 * - `getMfaRecoveryCodeStatus`: B10で残り本数を表示するために呼ぶ
 * - `resetMfaEnrollment`: B10の「2FAを再設定する」で呼ぶ。本人確認のうえTOTP登録を解除し、
 *   ユーザーをA3の再登録へ戻す
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
 * B10からの呼び出しに載る本人確認用のパスワード。
 *
 * A3(初回発行)はパスワードを送らないため任意にしてある。要否は入力の形ではなく
 * サーバー側の状態(`hasLiveRecoveryCodes`・2FAの登録有無)で決める。
 */
const passwordConfirmationSchema = z.object({ password: z.string().min(1).optional() });

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
  /** 本人確認が要る操作なのにパスワードが送られてこなかった */
  | "password-required"
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

/** 現在登録されている2要素目。本アプリが登録するのはTOTPだけなので先頭の1件を見る */
const getEnrolledFactor = (user: UserRecord): MultiFactorInfo | undefined =>
  user.multiFactor?.enrolledFactors[0];

/**
 * 保存済みのリカバリーコードが、いま登録されている2FAに対して有効かどうか。
 *
 * 有効なコードがある状態での発行は「再発行」であり、以前のコードを無効にしてしまう。
 * セッションを乗っ取られた状態で実行されると正規の利用者の復旧手段だけが失われるため、
 * この場合に限りパスワードでの本人確認を求める(docs/screen-requirements-account.md
 * 「リカバリーコードの再発行」)。逆にA3の初回発行は本人確認を挟まない。
 *
 * 判定は発行日時と2FAの登録日時の前後で行う。2FAを解除するときにコードも消しているので
 * (`deleteRecoveryCodes`)通常は「コードが無い=初回発行」で足りるが、削除に失敗して
 * 古いコードが残った場合でも、いまの2FAより前に発行されたものは復旧手段として使えないため
 * 初回発行として扱う。登録日時が読めないときだけは判定できないので、安全側に倒して本人確認を求める。
 */
const hasLiveRecoveryCodes = (status: RecoveryCodeStatus, factor: MultiFactorInfo): boolean => {
  if (status.generatedAt === null) {
    return false;
  }

  const enrolledAt =
    factor.enrollmentTime === undefined ? Number.NaN : Date.parse(factor.enrollmentTime);

  return Number.isNaN(enrolledAt) || status.generatedAt >= enrolledAt;
};

/**
 * パスワードを再検証し、通らなければ`HttpsError`を投げる(B10の本人確認)。
 *
 * 2FA登録済みのアカウントではサインインが完了せず`mfa-required`が返るが、
 * ここで確かめたいのは「パスワードが正しいこと」だけなので`signed-in`と同じ扱いにする。
 *
 * `user.email`が無いアカウントはパスワードで確認しようがないため、資格情報の誤りと同じ扱いにする。
 * 連携アカウント管理(B10)ではパスワードの解除を許しており、Googleのみのアカウントは
 * この本人確認を通せない = 2FAの再設定もリカバリーコードの発行もできない状態になる。これは
 * 承知のうえで、B10の解除確認ダイアログが実行前にその旨を伝える
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 */
const verifyPasswordOrThrow = async (user: UserRecord, password: string | undefined) => {
  if (password === undefined) {
    throw failure("failed-precondition", "password-required", "パスワードの入力が必要です");
  }

  const verification =
    user.email === undefined
      ? ({ status: "invalid-credential" } as const)
      : await verifyPassword(IDENTITY_PLATFORM_WEB_API_KEY.value(), user.email, password);

  switch (verification.status) {
    case "mfa-required":
    case "signed-in":
      return;
    case "invalid-credential":
      throw failure("permission-denied", "invalid-credential", "パスワードが正しくありません");
    case "too-many-requests":
      throw failure("permission-denied", "too-many-requests", "試行回数が多すぎます");
    default:
      throw failure("unavailable", "unavailable", "認証基盤に接続できませんでした");
  }
};

/**
 * 2FAの解除に成功したあと、使い道の無くなったリカバリーコードを捨てる。
 *
 * 解除自体は既に済んでいるため、消せなくても呼び出し元は失敗にしない。残ってしまった場合も
 * `hasLiveRecoveryCodes`が「いまの2FAより前に発行されたコード」と判定するので、
 * 次の登録(A3)で本人確認を求めてしまうことはない。
 */
const discardRecoveryCodes = async (uid: string): Promise<void> => {
  try {
    await deleteRecoveryCodes(uid);
  } catch (error) {
    console.error("リカバリーコードを削除できませんでした", error);
  }
};

/**
 * リカバリーコードを発行して平文を返す(A3の2FA登録完了時・B10の再発行)。
 *
 * 平文を返すのはこの応答の一度だけで、Firestoreにはハッシュしか残らない。
 * 既存のコードは無効になる(`replaceRecoveryCodes`)。
 *
 * いま登録されている2FAに対して有効なコードが既にある場合(=B10からの再発行)は、
 * サインイン済みであることに加えてパスワードでの本人確認を求める(`hasLiveRecoveryCodes`)。
 * 必須でない場合も、パスワードが渡されていれば必ず検証する。
 */
export const generateMfaRecoveryCodes = onCall(
  { secrets: [IDENTITY_PLATFORM_WEB_API_KEY] },
  async (request) => {
    const uid = request.auth?.uid;

    if (uid === undefined) {
      throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
    }

    const input = passwordConfirmationSchema.safeParse(request.data ?? {});

    if (!input.success) {
      throw new HttpsError("invalid-argument", "リクエストの形式が正しくありません");
    }

    const user = await getAuth().getUser(uid);

    // A3は「メール確認済み」「2FA登録済み」を満たした状態から呼ぶ。IDトークンの内容ではなく
    // Admin SDKで取得した現在の状態で確かめる(登録直後のトークンには反映されていないため)
    if (!user.emailVerified) {
      throw failure("failed-precondition", "email-unverified", "メールアドレスの確認が必要です");
    }

    const factor = getEnrolledFactor(user);

    if (factor === undefined) {
      throw failure("failed-precondition", "mfa-not-enrolled", "2段階認証の登録が必要です");
    }

    /*
      パスワードが渡されたら、必須かどうかに関わらず必ず検証する。
      B10は未発行の状態でも本人確認ダイアログを出すため、ここで素通しにすると
      「本人確認のため入力してください」と言いながら実際には確かめていないことになる。
    */
    if (
      input.data.password !== undefined ||
      hasLiveRecoveryCodes(await getRecoveryCodeStatus(uid), factor)
    ) {
      await verifyPasswordOrThrow(user, input.data.password);
    }

    const codes = createRecoveryCodes();
    await replaceRecoveryCodes(uid, await Promise.all(codes.map(createRecoveryCodeHash)));

    return { codes };
  },
);

/**
 * 本人確認のうえ2FA(TOTP)の登録を解除する(B10「2FAを再設定する」)。
 *
 * 解除だけを行い、登録し直しはA3に任せる。2FAは全ユーザー必須なので
 * (docs/auth-login-requirements.md 3.3)、解除した時点でログイン後画面のガードが
 * A3へ送り、登録が済むまで主要機能に戻れない(`src/frontend/src/lib/auth/app-access.ts`)。
 *
 * クライアント側の`multiFactor().unenroll()`を使わないのは、2FA登録済みのユーザーの
 * 再認証がパスワードだけでは完了せず、認証アプリの確認コードまで要求されるため。
 * 本人確認はパスワードの再入力とする要件(docs/screen-requirements-account.md B10)に
 * 合わせて、A5と同じくサーバー側でパスワードを再検証する。
 *
 * この呼び出しにはサインイン済みのIDトークンが要る。つまり2FAを通過したセッションが前提であり、
 * パスワードだけで2FAを外せる経路にはならない。
 */
export const resetMfaEnrollment = onCall(
  { secrets: [IDENTITY_PLATFORM_WEB_API_KEY] },
  async (request) => {
    const uid = request.auth?.uid;

    if (uid === undefined) {
      throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
    }

    const input = passwordConfirmationSchema.safeParse(request.data ?? {});

    if (!input.success) {
      throw new HttpsError("invalid-argument", "リクエストの形式が正しくありません");
    }

    const user = await getAuth().getUser(uid);

    if (!hasEnrolledFactor(user)) {
      throw failure("failed-precondition", "mfa-not-enrolled", "2段階認証が登録されていません");
    }

    await verifyPasswordOrThrow(user, input.data.password);

    try {
      await getAuth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
    } catch (error) {
      console.error("2段階認証の登録を解除できませんでした", error);
      throw failure("unavailable", "unenroll-failed", "2段階認証を解除できませんでした");
    }

    await discardRecoveryCodes(uid);

    return { ok: true };
  },
);

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

    await discardRecoveryCodes(user.uid);

    // `remainingCodes`は消費した時点で残っていた本数。上で解除に成功しているため、
    // 残っていたコードもここで捨てている(2FAが無ければ使えない)。呼び出し元は
    // 「解除できた」ことの確認にだけ使い、次に使えるコードの本数としては扱わない
    return { remainingCodes: consumed.remainingCodes };
  },
);
