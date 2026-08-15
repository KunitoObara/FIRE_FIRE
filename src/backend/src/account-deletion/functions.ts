import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/https";
import { z } from "zod";

import {
  IDENTITY_PLATFORM_WEB_API_KEY,
  callableFailure,
  passwordConfirmationSchema,
  verifyPasswordOrThrow,
} from "../auth/password-confirmation";
import { normalizeEmail } from "../signup-allowlist/email";
import {
  deleteRecoveryCodeDocument,
  deleteSignUpAllowlistEntry,
  deleteUserData,
} from "./store";

import type {
  CallableFailureCode,
  PasswordConfirmationFailureReason,
} from "../auth/password-confirmation";

/**
 * アカウント削除(docs/auth-login-requirements.md 3.11、docs/screen-requirements-account.md B10)。
 *
 * A10 プライバシーポリシーが「利用者からの削除の求めに応じる」と書く以上、実行する手段が要る。
 * コンソールでAuthのユーザーを消しても`users/{uid}`配下は残るため、**この処理はどのみち
 * Admin SDKでしか書けない**(クライアントSDKにサブコレクションの再帰削除が無い)。
 *
 * 本人確認はB10の他の後戻りできない操作(2FA再設定・リカバリーコード再発行・パスワード解除)と
 * 同じ**サーバー側でのパスワード再検証**に加えて、**登録メールアドレスの入力**を求める。
 * 他の3つと違い削除は復旧できないため、確認の強度を1段上げる(PO判断)。
 *
 * **パスワードを持たないアカウント(Googleのみ)では実行できない。** 他のパスワード再確認を
 * 伴う操作と同じ制約で(docs/auth-login-requirements.md 3.3)、画面側はボタンを無効化し
 * 問い合わせへ案内する。ここでも`password-not-linked`として明示的に弾き、UIを通さない
 * 呼び出しが本人確認を素通りしないようにする。
 */

const deleteAccountInputSchema = passwordConfirmationSchema.extend({
  /** 確認のために入力させる登録メールアドレス。表記の揺れは正規化して比べる */
  confirmEmail: z.string().min(1),
});

/** Firebaseがメール/パスワードのログイン方法に使う識別子 */
const PASSWORD_PROVIDER_ID = "password";

/** 画面が出し分けに使う失敗理由(`src/frontend/src/lib/auth/account-deletion.ts`が読む) */
type DeleteAccountFailureReason =
  | "unauthenticated"
  /** パスワードでのログインが無い。Googleのみのアカウントは本人確認を通せない */
  | "password-not-linked"
  /** 入力された確認用のメールアドレスが登録メールアドレスと一致しない */
  | "email-mismatch"
  /** Firestoreのデータを消せなかった。**アカウントは残っている**のでやり直せる */
  | "data-deletion-failed"
  /** データは消えたがAuthのユーザーを消せなかった。**やり直しが要る** */
  | "account-deletion-failed"
  | PasswordConfirmationFailureReason;

const failure = (
  code: CallableFailureCode,
  reason: DeleteAccountFailureReason,
  message: string,
): HttpsError => callableFailure(code, reason, message);

/** 既に削除済みのユーザーを消そうとしたときのエラーか(Admin SDKの`FirebaseAuthError`) */
const isUserNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "auth/user-not-found";

/**
 * 本人確認のうえ、アカウントと利用者のデータをすべて削除する。
 *
 * **消す順序に意味がある。Firestoreを先に、Authのユーザーを最後に消す。**
 * 逆にすると、Authのユーザーが消えたあとにFirestoreの削除が落ちた場合、**持ち主のいない
 * データが残り、本人はサインインできないのでやり直すこともできない**。この順序なら、
 * 途中で落ちても本人はまだサインインでき、もう一度実行して続きを消せる。
 *
 * 途中失敗が中途半端な状態を残すこと自体は避けられない(Firestoreの再帰削除とIdentity
 * Platformの削除にまたがるトランザクションは存在しない)。避けられるのは**復旧できない
 * 側に倒れること**だけなので、そちらを選んでいる。
 *
 * **別のタブが削除中に書いた分は消し残りうる。** 再帰削除が走ったあとAuthのユーザーを
 * 消すまでの間に書き込みが着くと、持ち主のいないドキュメントが残る。`revokeRefreshTokens`を
 * 先に呼んでも塞がらない — 発行済みのIDトークンは最長1時間有効で、`firestore.rules`は
 * トークンの`uid`だけを見るため、ユーザーが消えたあとの書き込みも通る。単一利用者の
 * ベータ期間では受容し、SaaS化の際に再評価する(docs/auth-login-requirements.md 3.11)。
 */
export const deleteAccount = onCall(
  {
    secrets: [IDENTITY_PLATFORM_WEB_API_KEY],
    /*
      既定の60秒では、取引が積み上がったアカウントで再帰削除が収まらないことがある
      (CSV1回の取込で最大20,000件。docs/transaction-import-requirements.md 8章)。
      失敗しても冪等にやり直せるが、**削除を求めた人にエラーを見せてやり直しを迫るのは
      最も避けたい場面**なので、1回で終わる見込みを上げておく。
    */
    timeoutSeconds: 300,
  },
  async (request) => {
    const uid = request.auth?.uid;

    if (uid === undefined) {
      throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
    }

    const input = deleteAccountInputSchema.safeParse(request.data ?? {});

    if (!input.success) {
      throw new HttpsError("invalid-argument", "リクエストの形式が正しくありません");
    }

    // IDトークンの内容ではなくAdmin SDKで取得した現在の状態で判定する
    // (別タブでの連携解除などがトークンに反映される前に古い前提で消さないため)
    let user;

    try {
      user = await getAuth().getUser(uid);
    } catch (error) {
      // 1回目の呼び出しが最後まで終わったあとに2回目が届くと、ここで見つからない。
      // 目的は達しているので成功として返す(下の`deleteUser`と同じ理由)
      if (isUserNotFoundError(error)) {
        return { ok: true };
      }

      throw error;
    }

    if (!user.providerData.some((provider) => provider.providerId === PASSWORD_PROVIDER_ID)) {
      throw failure(
        "failed-precondition",
        "password-not-linked",
        "パスワードでのログインが設定されていないため削除できません",
      );
    }

    // 確認用のメールアドレスはパスワードの照合より先に見る。打ち間違いのたびに
    // Identity Platformへ問い合わせると、正規の利用者が上流のレート制限に当たる
    if (
      user.email === undefined ||
      normalizeEmail(input.data.confirmEmail) !== normalizeEmail(user.email)
    ) {
      throw failure(
        "failed-precondition",
        "email-mismatch",
        "入力されたメールアドレスが登録メールアドレスと一致しません",
      );
    }

    await verifyPasswordOrThrow(user, input.data.password);

    try {
      await deleteUserData(uid);
      await deleteRecoveryCodeDocument(uid);
      await deleteSignUpAllowlistEntry(user.email);
    } catch (error) {
      // 何をどこまで消せたかはログにも残さない。uid以外の手掛かりを増やさないため
      console.error("利用者のデータを削除できませんでした", error);
      throw failure(
        "unavailable",
        "data-deletion-failed",
        "データを削除できませんでした。アカウントは削除していません",
      );
    }

    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      // 既に消えているなら目的は達している。ボタンの二度押しで2回届いた場合、
      // 後から着いた呼び出しがここに来る。失敗として返すと「データは消えたが
      // アカウントが残っている」という誤った案内を出すことになる
      if (isUserNotFoundError(error)) {
        return { ok: true };
      }

      console.error("アカウントを削除できませんでした", error);
      throw failure(
        "unavailable",
        "account-deletion-failed",
        "データは削除しましたが、アカウントを削除できませんでした",
      );
    }

    return { ok: true };
  },
);
