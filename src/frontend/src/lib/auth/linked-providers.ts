import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, linkWithPopup, reload, unlink } from "firebase/auth";

import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

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
 * **最後に残った1つは解除しない。** Firebaseの`unlink`はログイン方法が無くなる解除も
 * そのまま通し、サインインする手段の無いアカウントが残ってしまうため、ここが唯一の歯止めになる
 * (docs/screen-requirements-account.md「連携アカウントの管理」の制約)。画面側でもボタンを
 * 無効化するが、判定はこちらにも置く — 別タブでの解除などで画面の状態が古くなりうるため。
 *
 * 残数は`providerData`の全体で数える。ここで扱わないプロバイダが将来増えても、
 * それがログイン方法である以上は「最後の1つ」の判定に含める必要がある。
 */
export const unlinkProvider = async (
  providerId: LinkedProviderId,
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
