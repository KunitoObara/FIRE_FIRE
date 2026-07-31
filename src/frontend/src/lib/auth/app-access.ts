import { onIdTokenChanged } from "firebase/auth";

import { isAppAccessGuardBypassed } from "@/constants/dev";
import { hasEnrolledTotp } from "@/lib/auth/mfa-enrollment";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

import type { User } from "firebase/auth";

/**
 * ログイン後画面(B1〜B10)を表示してよい状態かを判定する。
 *
 * 判定順は認証フローの手順と同じで、前の手順が終わっていないうちは後の手順を見ない
 * (docs/screen-list-and-transitions.md の認証フロー)。
 *
 * - セッションが無い → A4 ログイン画面
 * - メールアドレスが未確認 → A2 メールアドレス確認待ち画面
 * - 2FA(TOTP)が未登録 → A3 2FA登録画面。2FAは全ユーザー必須で、登録が済むまで主要機能を使わせない
 *   (docs/auth-login-requirements.md 3.3)
 *
 * Firebaseのユーザー情報だけを見る副作用の無い関数にしてあるため、画面を動かさずに単体テストできる。
 */
export const resolveAppAccessState = (user: User | null): ResolvedAppAccessState => {
  if (user === null) {
    return "signed-out";
  }

  if (!user.emailVerified) {
    return "email-unverified";
  }

  if (!hasEnrolledTotp(user)) {
    return "mfa-required";
  }

  return "ready";
};

/**
 * 認証状態の変化を購読し、そのつど判定結果を通知する。
 *
 * 購読には`onAuthStateChanged`ではなく`onIdTokenChanged`を使う。2FAの登録(A3)は
 * サインイン状態を変えずにIDトークンだけを更新するため、`onAuthStateChanged`では
 * 「2FA未登録」の判定が古いまま残る。どちらも購読の直後に現在のユーザーで一度発火するので、
 * セッション復元後の初期判定もこれで足りる。
 *
 * Firebaseの設定値が足りないと購読を始めることすらできない。この場合はログイン画面へ送っても
 * 同じところで止まるため、専用の状態を通知して対処法を出させる。
 *
 * 開発時の迂回が有効な場合はFirebaseに一切触れずに`ready`を返す(`src/constants/dev.ts`)。
 * エミュレータではTOTPを登録できず、ローカルでは常に`mfa-required`になってしまうため。
 *
 * 戻り値は購読の解除関数。
 */
export const subscribeToAppAccessState = (
  onChange: (state: AppAccessState) => void,
): (() => void) => {
  if (isAppAccessGuardBypassed()) {
    onChange("ready");
    return () => {};
  }

  try {
    return onIdTokenChanged(getFirebaseAuth(), (user) => {
      onChange(resolveAppAccessState(user));
    });
  } catch (error) {
    if (!(error instanceof FirebaseConfigurationError)) {
      throw error;
    }

    onChange("configuration-error");
    return () => {};
  }
};
