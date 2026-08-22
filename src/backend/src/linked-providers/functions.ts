import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/https";

import { onCallWithSentry } from "../sentry/report";
import { SENTRY_DSN } from "../sentry/secrets";
import {
  IDENTITY_PLATFORM_WEB_API_KEY,
  callableFailure,
  passwordConfirmationSchema,
  verifyPasswordOrThrow,
} from "../auth/password-confirmation";

import type { CallableFailureCode, PasswordConfirmationFailureReason } from "../auth/password-confirmation";

/**
 * 連携ログイン方法の管理のうち、サーバー側で行う操作
 * (docs/screen-requirements-account.md「連携アカウントの管理」)。
 *
 * Googleの連携・解除はクライアントSDK(`src/frontend/src/lib/auth/linked-providers.ts`)で
 * 完結する。ここに置くのはパスワードでのログインの解除だけで、理由は本人確認が要ることにある。
 *
 * パスワードの解除は事実上やり直せない。Googleのみのアカウントへパスワードを設定する導線が
 * このアプリには無く(docs/auth-login-requirements.md 8章のオープン課題)、解除と同時に
 * 2FAの再設定・リカバリーコードの発行/再発行・A5でのリカバリーコードによる復旧もすべて
 * 使えなくなるため。確認ダイアログだけでは、失うものの重さに対して確認の強度が釣り合わない。
 *
 * 検証と解除を1つの呼び出しにまとめてあるのは、分けると「検証は通した」という結果を
 * 呼び出し側が自己申告することになり、解除の前提として意味を持たなくなるため
 * (2FAの解除を`resetMfaEnrollment`でまとめているのと同じ理由)。
 *
 * ただし**これはクライアントSDKでの解除を禁止するものではない**。Identity Platformには
 * ユーザー更新に対するブロッキング関数が無く、有効なIDトークンを持つ相手は`accounts:update`を
 * 直接叩いて解除できる。ここで担保できるのは「このアプリが提供する経路では本人確認を必ず通る」
 * ことまでで、セッションを完全に掌握された場合の防御にはならない。
 */

/** Firebaseがメール/パスワードのログイン方法に使う識別子 */
const PASSWORD_PROVIDER_ID = "password";

/** 画面が出し分けに使う失敗理由(`src/frontend/src/lib/auth/linked-providers.ts`が読む) */
type UnlinkPasswordFailureReason =
  | "unauthenticated"
  /** パスワードでのログインが設定されていない。別タブで解除した後などに起きる */
  | "not-linked"
  /** 最後に残った1つは解除できない。解除するとサインインする手段が無くなるため */
  | "last-provider"
  /** 本人確認は通ったが、Identity Platform側で解除できなかった */
  | "unlink-failed"
  | PasswordConfirmationFailureReason;

const failure = (
  code: CallableFailureCode,
  reason: UnlinkPasswordFailureReason,
  message: string,
): HttpsError => callableFailure(code, reason, message);

/**
 * 本人確認のうえ、メールアドレス / パスワードでのログインを解除する
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 *
 * 「最後に残った1つは解除できない」の判定もここで行う。Identity Platformの更新APIは
 * ログイン方法が無くなる解除もそのまま通し、サインインする手段の無いアカウントが残るため。
 * 画面側でもボタンを無効化するが、別タブでの解除などで画面の状態は古くなりうる。
 *
 * 残数は`providerData`の全体で数える。ここで扱わないログイン方法が将来増えても、
 * それがログイン方法である以上は「最後の1つ」の判定に含める必要がある。
 */
export const unlinkPasswordProvider = onCallWithSentry(
  { secrets: [IDENTITY_PLATFORM_WEB_API_KEY, SENTRY_DSN] },
  async (request) => {
    const uid = request.auth?.uid;

    if (uid === undefined) {
      throw failure("unauthenticated", "unauthenticated", "サインインが必要です");
    }

    const input = passwordConfirmationSchema.safeParse(request.data ?? {});

    if (!input.success) {
      throw new HttpsError("invalid-argument", "リクエストの形式が正しくありません");
    }

    // IDトークンの内容ではなくAdmin SDKで取得した現在の状態で判定する。
    // 別タブでの連携・解除がトークンに反映されるまでの間に古い前提で解除しないため
    const user = await getAuth().getUser(uid);

    if (!user.providerData.some((provider) => provider.providerId === PASSWORD_PROVIDER_ID)) {
      throw failure(
        "failed-precondition",
        "not-linked",
        "パスワードでのログインは設定されていません",
      );
    }

    if (user.providerData.length <= 1) {
      throw failure(
        "failed-precondition",
        "last-provider",
        "唯一のログイン方法のため解除できません",
      );
    }

    await verifyPasswordOrThrow(user, input.data.password);

    try {
      await getAuth().updateUser(uid, { providersToUnlink: [PASSWORD_PROVIDER_ID] });
    } catch (error) {
      console.error("パスワードでのログインを解除できませんでした", error);
      throw failure("unavailable", "unlink-failed", "パスワードでのログインを解除できませんでした");
    }

    return { ok: true };
  },
);
