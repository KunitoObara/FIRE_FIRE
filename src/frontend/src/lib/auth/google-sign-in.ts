import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  getMultiFactorResolver,
  linkWithCredential,
  setPersistence,
  signInWithPopup,
} from "firebase/auth";

import { reloadEmailVerificationState } from "@/lib/auth/email-verification";
import { markGoogleLinkFailed } from "@/lib/auth/google-link-notice";
import {
  clearPendingGoogleLink,
  getPendingGoogleLink,
  setPendingGoogleLink,
} from "@/lib/auth/pending-google-link";
import { clearPendingLogin, setPendingLogin } from "@/lib/auth/pending-login";
import { persistenceFor } from "@/lib/auth/session-persistence";
import { FirebaseConfigurationError, getFirebaseAuth } from "@/lib/firebase/client";

import type { MultiFactorError } from "firebase/auth";

/**
 * 2FAの確認コード入力が必要な状態か。
 * `sign-in.ts`と同じく、一次認証は通過しているため失敗ではなくA5へ進む合図として扱う。
 * Identity PlatformのMFAはフェデレーションログインにも適用される
 * (docs/auth-login-requirements.md 3.8)。
 */
const isMultiFactorRequired = (error: unknown): error is MultiFactorError =>
  error instanceof FirebaseError && error.code === "auth/multi-factor-auth-required";

/**
 * 同一メールアドレスのパスワードアカウントが既に存在するか。
 * Identity Platformの「メールアドレスごとに1つのアカウント」設定(既定)が前提
 * (docs/ci-cd-setup.md 10.2)。
 */
const isAccountExistsWithDifferentCredential = (error: unknown): error is FirebaseError =>
  error instanceof FirebaseError && error.code === "auth/account-exists-with-different-credential";

const toFailureReason = (error: unknown): GoogleSignInFailureReason => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  if (!(error instanceof FirebaseError)) {
    return "unknown";
  }

  switch (error.code) {
    // どちらもユーザーがポップアップを開いたまま進めなかっただけで、失敗ではない。
    // `cancelled-popup-request`は二重に開いた場合に古い方へ返るもので、扱いは同じ
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "popup-closed";
    case "auth/popup-blocked":
      return "popup-blocked";
    case "auth/operation-not-allowed":
      return "provider-disabled";
    case "auth/unauthorized-domain":
      return "unauthorized-domain";
    case "auth/user-disabled":
      return "user-disabled";
    case "auth/too-many-requests":
      return "too-many-requests";
    case "auth/network-request-failed":
      return "network-error";
    default:
      return "unknown";
  }
};

/**
 * Googleアカウントで一次認証を行う(A1・A4の「Googleで続ける」)。
 *
 * Google側ではサインアップとログインを区別できないため、A1から始めてもA4から始めても
 * 処理は同一で、結果によって遷移先だけが変わる(docs/screen-requirements-auth.md 2章)。
 *
 * 戻り値の`next`は3通りに落ちる。
 * - `mfa-setup` — 新規作成またはまだ2FAが未登録のアカウント。GoogleのメールアドレスはGoogle側で
 *   確認済みのため、新規でもA2は挟まずA3へ進む(docs/auth-login-requirements.md 3.8)
 * - `mfa-verify` — 2FA登録済み。ポップアップの成功時点ではサインインが成立せず
 *   `auth/multi-factor-auth-required`となるため、A5へ渡す検証セッションを預けて進む
 * - `link-account` — 同一メールアドレスのパスワードアカウントが既にある。A8で連携する
 */
export const signInWithGoogle = async (rememberMe: boolean): Promise<GoogleSignInResult> => {
  // 前回の試行で預けた検証待ち・連携待ちを先に捨てる。モジュールスコープの変数はSPA遷移では
  // 消えないため、やり直したときに古い資格情報が紛れ込まないようにする(`sign-in.ts`と同じ理由)
  clearPendingLogin();
  clearPendingGoogleLink();

  try {
    const auth = getFirebaseAuth();

    // セッションの保存先は資格情報を渡す前に確定させる。2FAありの場合に実際に
    // セッションが作られるのはA5の検証成功時のため、A5も同じ選択を適用し直す
    await setPersistence(auth, persistenceFor(rememberMe));

    const credential = await signInWithPopup(auth, new GoogleAuthProvider());

    // GoogleのメールアドレスはGoogle側で確認済みとして渡るため、通常ここは通らない。
    // それでも見ているのは、A4からの経路(`sign-in.ts`)と遷移先の判断を揃えるため
    if (!credential.user.emailVerified) {
      return { ok: true, next: "email-unverified" };
    }

    return { ok: true, next: "mfa-setup" };
  } catch (error) {
    if (isMultiFactorRequired(error)) {
      setPendingLogin({
        // ここに来た時点でAuthの取得は成功している。生成済みのインスタンスが返る
        resolver: getMultiFactorResolver(getFirebaseAuth(), error),
        // A5の確認表示に使う。Googleログインでは入力値が無いのでエラーに載る値を使い、
        // 得られない場合は空文字にする(A5側で表示を切り替える)
        email: error.customData.email ?? "",
        // パスワードは渡さない。A5の「リカバリーコードを使う」はサーバー側での
        // パスワード再確認を伴うため、Googleログインでは成立しない(同 3.8・8章)
        rememberMe,
      });
      return { ok: true, next: "mfa-verify" };
    }

    if (isAccountExistsWithDifferentCredential(error)) {
      const credential = GoogleAuthProvider.credentialFromError(error);
      const email = error.customData?.email;

      // どちらもFirebaseが載せてくるはずの値で、欠けていればA8でできることが無い。
      // 連携せずログインし直してもらうため、専用の理由は設けず`unknown`に落とす
      if (credential === null || typeof email !== "string") {
        console.error("Googleの資格情報を取り出せませんでした", error);
        return { ok: false, reason: "unknown" };
      }

      setPendingGoogleLink({ credential, email, rememberMe });
      return { ok: true, next: "link-account" };
    }

    const reason = toFailureReason(error);
    if (reason === "unknown") {
      console.error("Googleログインに失敗しました", error);
    }
    return { ok: false, reason };
  }
};

/**
 * 預かっていたGoogleの資格情報を、サインイン済みのアカウントへ連携する
 * (A8。2FA登録済みならA5の検証成功後、未登録ならA8のパスワード検証直後)。
 *
 * 連携待ちが無ければ何もしない。A5は通常のログインでも通るため、呼び出し側で
 * 経路を判定せずそのまま呼べるようにしてある。
 *
 * 失敗しても呼び出し元は先へ進む。この時点でサインイン自体は成立しており、連携できなかった
 * ことはログインを取り消す理由にならないため(docs/screen-requirements-auth.md A8)。
 * 代わりにフラグを立て、B1がトーストで通知する。
 *
 * 成否によらず連携待ちは消費する。同じ資格情報での再試行は期待できず(短命なうえ、
 * `credential-already-in-use`は再試行しても結果が変わらない)、残すと次のログインに紛れ込むため。
 *
 * 連携先が「連携待ちと同じメールアドレスのアカウント」であることも確認する。A8を途中で
 * 離脱しても連携待ちはメモリに残るため、無条件に連携すると別のアカウントへ資格情報を
 * 付けてしまう経路が残る。A4は次のログイン試行で連携待ちを捨てるが、それだけに頼らない。
 */
export const linkPendingGoogleAccount = async (): Promise<void> => {
  const pending = getPendingGoogleLink();
  clearPendingGoogleLink();

  if (pending === null) {
    return;
  }

  try {
    const user = getFirebaseAuth().currentUser;

    if (user === null) {
      // 連携はサインイン成立後にしか呼ばれない想定。ここに来るのは想定外の状態
      console.error("連携先のサインイン済みアカウントがありません");
      markGoogleLinkFailed();
      return;
    }

    // A8が連携するのは「同じメールアドレスの既存アカウント」に限られる。ここが一致しない
    // ということは、A8を離脱したあと別のアカウントでログインし直した等で連携待ちが
    // 残っていたということなので、連携せずに捨てる。実行してしまうと、A8で本人確認を
    // 通していないアカウントにGoogleの資格情報が付き、以後そのGoogleアカウントで
    // ログインできてしまう。
    //
    // B1の通知も出さない。連携を試みたのは今サインインした人ではないため、
    // 「連携できませんでした」と伝えても心当たりが無い
    if (user.email?.toLowerCase() !== pending.email.toLowerCase()) {
      console.error("連携待ちのGoogleアカウントとサインイン中のアカウントが一致しません");
      return;
    }

    await linkWithCredential(user, pending.credential);
  } catch (error) {
    // 資格情報の期限切れ、`auth/credential-already-in-use`(そのGoogleアカウントが
    // 別のFIRE-FIREアカウントで使用済み)、通信失敗などを想定する。いずれもサインインは
    // 成立しているため扱いは同じ(docs/screen-requirements-dashboard.md B1)
    console.error("Googleアカウントを連携できませんでした", error);
    markGoogleLinkFailed();
  }
};

/**
 * A8で連携を実行したあとの遷移先を決め直す(2FA未登録の分岐)。
 *
 * A8のパスワード検証が返す`next`は**連携前**の`emailVerified`で決まっている。連携する
 * GoogleアカウントのメールアドレスはGoogle側で確認済みのため、連携によってこれがtrueへ
 * 変わりうる。読み直さずにそのまま使うと、確認済みになったユーザーを不要なA2へ送ってしまう。
 *
 * Identity Platformが実際にtrueへ変えるかは、その挙動を前提にせず**毎回読み直して**判断する。
 * どちらの挙動でも遷移先が正しくなり、Identity Platform側が将来変わっても壊れないため
 * (docs/screen-requirements-auth.md A8)。
 *
 * 取り直せなかった場合(通信失敗・設定不足・セッション消失)は連携前の判断をそのまま使う。
 * 誤りうるのは「本当は確認済みなのにA2へ送る」側だけで、これはA2自身が確認状況を
 * ポーリングしているため確認済みになった時点で自動的にA3へ進む(`VerifyEmailNotice`)。
 * 逆向き(本当は未確認なのにA3へ送る)は起きない — `mfa-setup`が返るのは連携前が確認済み
 * だった場合に限られ、連携で未確認へ戻ることは無いため。行き止まりにならない以上、
 * ここで取得失敗を理由にユーザーを止める理由が無い。
 *
 * A1〜A8は`AppAccessGuard`(`(dashboard)`レイアウト、B1〜B10のみ)の外側にあるので、
 * 差し戻しをガードに期待してはいけない。上記のA2のポーリングを消すとここが行き止まりになる。
 */
export const resolveNextStepAfterLink = async (
  beforeLink: SignInNextStep,
): Promise<SignInNextStep> => {
  const state = await reloadEmailVerificationState();

  switch (state.status) {
    case "verified":
      // A8のこの分岐に来ている時点で2FAは未登録と分かっている
      return "mfa-setup";
    case "unverified":
      return "email-unverified";
    default:
      return beforeLink;
  }
};
