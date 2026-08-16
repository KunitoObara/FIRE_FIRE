import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, linkWithPopup, reload, unlink } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { UNLINK_PASSWORD_PROVIDER_FUNCTION } from "@/constants/firebase";
import { toCallableFailureReason } from "@/lib/auth/callable-error";
import {
  FirebaseConfigurationError,
  getFirebaseAuth,
  getFirebaseFunctions,
} from "@/lib/firebase/client";

import type { User } from "firebase/auth";

/**
 * 連携済みログイン方法の確認・追加・解除
 * (docs/screen-requirements-account.md「連携アカウントの管理」、
 * docs/auth-login-requirements.md 3.8)。
 *
 * A8がログイン中の連携(同一メールアドレスの衝突)を扱うのに対し、こちらは
 * サインイン済みのアカウントに対する管理操作を扱う。どちらもポップアップ方式で、
 * 一次認証を通過済みの`currentUser`に資格情報を足す・外す点だけが違う。
 */

/** 画面に出す順。A1・A4と同じくメール/パスワードを主、Googleを副として並べる */
const MANAGED_PROVIDER_IDS: readonly LinkedProviderId[] = ["password", "google.com"];

/** メール/パスワードのログイン方法の識別子。Firebaseが付ける値そのもの */
const PASSWORD_PROVIDER_ID: LinkedProviderId = "password";

/**
 * 連携後・解除後にブラウザ側が持つユーザー情報を取り直す。
 *
 * `linkWithPopup`・`unlink`はどちらも`providerData`を更新した`User`を返すが、
 * 画面は`currentUser`を読み直して一覧を作るため、取得元を1つに揃えるためここで反映する。
 *
 * 失敗しても連携・解除自体は済んでいるため呼び出し元は成功として扱う。表示が古いままになるが、
 * 画面を開き直せば正しくなる(操作自体を巻き戻す方が実害が大きい)。
 */
const refreshProviderData = async (user: User): Promise<void> => {
  try {
    await reload(user);
  } catch (error) {
    console.error("ログイン方法の変更後にユーザー情報を取り直せませんでした", error);
  }
};

const toLinkFailureReason = (error: unknown): LinkGoogleFailureReason => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    // ユーザーがポップアップを開いたまま進めなかっただけで、失敗ではない
    // (`google-sign-in.ts`と同じ扱い)
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "popup-closed";
    case "auth/popup-blocked":
      return "popup-blocked";
    // そのGoogleアカウントが別のFIRE-FIREアカウントで使用済み。「メールアドレスごとに1つの
    // アカウント」設定の下ではメールアドレス側の衝突として返ることもあるため、両方を同じ扱いにする
    case "auth/credential-already-in-use":
    case "auth/email-already-in-use":
      return "credential-already-in-use";
    case "auth/provider-already-linked":
      return "provider-already-linked";
    case "auth/requires-recent-login":
      return "requires-recent-login";
    case "auth/operation-not-allowed":
      return "provider-disabled";
    case "auth/unauthorized-domain":
      return "unauthorized-domain";
    case "auth/too-many-requests":
      return "too-many-requests";
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

const toUnlinkFailureReason = (error: unknown): UnlinkProviderFailureReason => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    case "auth/no-such-provider":
      return "not-linked";
    case "auth/requires-recent-login":
      return "requires-recent-login";
    case "auth/too-many-requests":
      return "too-many-requests";
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

/**
 * パスワードでのログインが設定されているか(docs/auth-login-requirements.md 3.3)。
 *
 * パスワードの再入力を本人確認に使う操作 — 2FAの再設定・リカバリーコードの発行/再発行・
 * アカウントの削除(3.11) — は、Googleのみのアカウントでは通せない。押してから断るのではなく、
 * 押す前に無効化して理由を出すために画面が使う。
 *
 * 判定は`providerData`そのものから行う。IDトークンの内容ではなくSDKが保持している現在の
 * 連携状況を見るため、別タブでの連携・解除の直後でも取り違えにくい。
 */
export const hasPasswordProvider = (user: User | null): boolean =>
  user?.providerData.some((provider) => provider.providerId === PASSWORD_PROVIDER_ID) ?? false;

/**
 * サーバー側の最新の状態でパスワードでのログインの有無を確かめる。
 *
 * `hasPasswordProvider`は**描画した時点のSDKの状態**しか見ない。同じ画面でパスワード連携を
 * 解除した直後は`currentUser`が古いままで、削除ボタンが有効に見えてしまう。後戻りできない
 * 操作を始める直前だけは`reload`して取り直す。
 *
 * 取り直しに失敗したら**現在分かっている値をそのまま返す**。ここで`false`に倒すと、
 * 一時的な通信の失敗で削除できないと言うことになる(最終的な判定はサーバー側の
 * `password-not-linked`が持っている)。
 */
export const refreshPasswordProviderState = async (): Promise<boolean> => {
  const user = getFirebaseAuth().currentUser;

  if (user === null) {
    return false;
  }

  try {
    await reload(user);
  } catch (error) {
    console.error("ログイン方法を取り直せませんでした", error);
  }

  return hasPasswordProvider(getFirebaseAuth().currentUser);
};

/**
 * 現在のログイン方法の一覧を作る。
 *
 * 未サインインでも一覧の形は変えず、すべて未連携として返す。この画面はガードの内側にしか
 * 無いため通常は起きないが、表示を空にするとセッション切れが「連携が消えた」ように見えるため。
 */
export const getLinkedProviders = (): LinkedProviderStatus[] => {
  const providerData = getFirebaseAuth().currentUser?.providerData ?? [];

  return MANAGED_PROVIDER_IDS.map((id) => {
    const linked = providerData.find((provider) => provider.providerId === id);

    return { id, isLinked: linked !== undefined, email: linked?.email ?? null };
  });
};

/**
 * サインイン済みのアカウントにGoogleを連携する。
 *
 * 一次認証は済んでいるためポップアップの成功がそのまま連携になり、2FAは要求されない
 * (2FAはアカウント単位の設定で、連携によって変化しない — docs/auth-login-requirements.md 3.8)。
 */
export const linkGoogleAccount = async (): Promise<LinkGoogleResult> => {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user) {
      return { ok: false, reason: "signed-out" };
    }

    await linkWithPopup(user, new GoogleAuthProvider());
    await refreshProviderData(user);

    return { ok: true };
  } catch (error) {
    const reason = toLinkFailureReason(error);

    if (reason === "unknown") {
      console.error("Googleアカウントを連携できませんでした", error);
    }

    return { ok: false, reason };
  }
};

/**
 * 連携済みのログイン方法を解除する。
 *
 * 扱うのは連携し直せるログイン方法だけで、パスワードは受け取らない
 * (`ClientUnlinkableProviderId`)。パスワードの解除は本人確認を挟むため
 * `unlinkPasswordProvider`を通す。
 *
 * **最後に残った1つは解除しない。** Firebaseの`unlink`はログイン方法が無くなる解除も
 * そのまま通し、サインインする手段の無いアカウントが残ってしまうため、ここが唯一の歯止めになる
 * (docs/screen-requirements-account.md「連携アカウントの管理」の制約)。画面側でもボタンを
 * 無効化するが、判定はこちらにも置く — 別タブでの解除などで画面の状態が古くなりうるため。
 *
 * 残数は`providerData`の全体で数える。ここで扱わないプロバイダが将来増えても、
 * それがログイン方法である以上は「最後の1つ」の判定に含める必要がある。
 */
export const unlinkProvider = async (
  providerId: ClientUnlinkableProviderId,
): Promise<UnlinkProviderResult> => {
  try {
    const user = getFirebaseAuth().currentUser;

    if (!user) {
      return { ok: false, reason: "signed-out" };
    }

    if (!user.providerData.some((provider) => provider.providerId === providerId)) {
      return { ok: false, reason: "not-linked" };
    }

    if (user.providerData.length <= 1) {
      return { ok: false, reason: "last-provider" };
    }

    await unlink(user, providerId);
    await refreshProviderData(user);

    return { ok: true };
  } catch (error) {
    const reason = toUnlinkFailureReason(error);

    if (reason === "unknown") {
      console.error("ログイン方法を解除できませんでした", error);
    }

    return { ok: false, reason };
  }
};

/** バックエンドの`details.reason`として受け付ける値 */
const UNLINK_PASSWORD_FAILURE_REASONS: readonly UnlinkPasswordFailureReason[] = [
  "signed-out",
  "not-linked",
  "last-provider",
  "password-required",
  "invalid-credential",
  "too-many-requests",
  "unlink-failed",
];

/**
 * 本人確認のうえ、メールアドレス / パスワードでのログインを解除する
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 *
 * Googleの解除と違いクライアントSDKの`unlink`を使わない。パスワードの解除は事実上やり直せず、
 * 2FAの再設定・リカバリーコードの発行/再発行・A5での復旧まで一緒に失う操作のため、
 * 確認ダイアログではなくパスワードの再入力を求める。その検証はサーバー側でなければ行えない
 * (2FA登録済みのユーザーはクライアントSDKの再認証がパスワードだけでは完了しない)ので、
 * 検証と解除をまとめてcallableで行う(`src/backend/src/linked-providers/functions.ts`)。
 */
export const unlinkPasswordProvider = async (password: string): Promise<UnlinkPasswordResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), UNLINK_PASSWORD_PROVIDER_FUNCTION);
    await callable({ password });

    // 解除はサーバー側(Admin SDK)で行うため、`currentUser.providerData`は古いままになる。
    // 取り直さないと一覧が「解除できていない」ように見える
    const user = getFirebaseAuth().currentUser;

    if (user !== null) {
      await refreshProviderData(user);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        UNLINK_PASSWORD_FAILURE_REASONS,
        "パスワードでのログインを解除できませんでした",
      ),
    };
  }
};
