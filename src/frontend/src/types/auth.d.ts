import type { MultiFactorResolver, OAuthCredential, TotpSecret } from "firebase/auth";
import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

import type { accountLinkSchema } from "@/schemas/account-link";
import type { forgotPasswordSchema } from "@/schemas/forgot-password";
import type { loginSchema } from "@/schemas/login";
import type { resetPasswordSchema } from "@/schemas/reset-password";
import type { signupSchema } from "@/schemas/signup";

// 認証(A1〜A8)関連の型。import を持つため既にモジュールであり、
// `declare global` でグローバルへ公開する。
declare global {
  /**
   * A1サインアップフォームの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type SignupFormValues = z.infer<typeof signupSchema>;

  /**
   * A1サインアップで画面に出し分ける必要がある失敗理由。
   * Firebaseのエラーコードをそのまま画面に持ち込まないための境界。
   */
  type SignUpFailureReason =
    | "email-already-in-use"
    | "invalid-email"
    | "password-policy-violation"
    /**
     * 承認されていないメールアドレス(ベータ期間中の招待制。
     * docs/auth-login-requirements.md 3.10)。恒久的な制限ではないため、
     * 文言もベータ期間中のものだと伝わる形にする
     */
    | "signup-not-allowed"
    /** 許可リストを確かめられずに拒否された(同 fail-closed)。時間をおけば通りうる */
    | "signup-check-unavailable"
    | "too-many-requests"
    | "configuration-error"
    | "network-error"
    | "unknown";

  type SignUpResult = { ok: true } | { ok: false; reason: SignUpFailureReason };

  /** 特定の入力項目に紐づかず、フォーム全体のエラーとして表示する失敗理由 */
  type SignUpFormLevelFailureReason = Extract<
    SignUpFailureReason,
    | "signup-not-allowed"
    | "signup-check-unavailable"
    | "too-many-requests"
    | "configuration-error"
    | "network-error"
    | "unknown"
  >;

  /**
   * A2で表示するメールアドレス確認の状況。
   * Firebaseの`User`をそのまま画面に持ち込まず、A2が出し分ける状態だけに絞る。
   */
  type EmailVerificationState =
    | { status: "loading" }
    /** セッションが無い(直接アクセス・サインアウト済み)。A1へ戻す */
    | { status: "signed-out" }
    /** 未確認。`email`は送信先の表示に使う(取得できない場合はnull) */
    | { status: "unverified"; email: string | null }
    /** 確認済み。A3へ進む */
    | { status: "verified" }
    | { status: "configuration-error" }
    /** リクエストがFirebaseに届かない */
    | { status: "network-error" }
    | { status: "unknown-error" };

  /** A2で確認状況を取得できず、画面にエラーとして出す状態 */
  type EmailVerificationErrorStatus = Extract<
    EmailVerificationState["status"],
    "configuration-error" | "network-error" | "unknown-error"
  >;

  /** A2の確認メール再送で画面に出し分ける必要がある失敗理由 */
  type ResendVerificationEmailFailureReason =
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  type ResendVerificationEmailResult =
    | { ok: true }
    /** 再送対象のユーザーが居ない。A1へ戻す */
    | { ok: false; reason: "no-session" }
    | { ok: false; reason: ResendVerificationEmailFailureReason };

  /** A2の再送操作の結果として画面に出すメッセージ */
  type ResendVerificationEmailFeedback = {
    kind: "success" | "error";
    message: string;
  };

  /**
   * A3のQRコード生成(登録の開始)で画面に出し分ける必要がある失敗理由。
   * Firebaseのエラーコードをそのまま画面に持ち込まないための境界。
   */
  type TotpEnrollmentStartFailureReason =
    /** セッションが無い(直接アクセス・サインアウト済み)。A1へ戻す */
    | "signed-out"
    /** メールアドレスが未確認。2FA登録の前提を満たしていないためA2へ戻す */
    | "email-unverified"
    /** 既に2FA登録済み。A3に留まる意味がないためB1へ進める */
    | "already-enrolled"
    /** 再認証が必要なほどセッションが古い。ログインし直しを促す */
    | "requires-recent-login"
    /** プロジェクト側でTOTP多要素認証が有効化されていない */
    | "totp-not-enabled"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  /**
   * A3の登録開始結果。
   * `secret`はFirebaseが発行する登録セッションそのもので、画面側は検証時に返すためだけに保持する
   * (シークレットの中身を画面のロジックで解釈しない)。
   */
  type TotpEnrollmentStartResult =
    | { ok: true; secret: TotpSecret; qrCodeUrl: string }
    | { ok: false; reason: TotpEnrollmentStartFailureReason };

  /** 登録開始の失敗のうち、A3では解決できず他画面へ移すもの */
  type TotpEnrollmentStartRedirectFailureReason = Extract<
    TotpEnrollmentStartFailureReason,
    "signed-out" | "email-unverified" | "already-enrolled"
  >;

  /** 登録開始の失敗のうち、A3に留まってメッセージとして出すもの */
  type TotpEnrollmentStartDisplayFailureReason = Exclude<
    TotpEnrollmentStartFailureReason,
    TotpEnrollmentStartRedirectFailureReason
  >;

  /** A3の確認コード検証で画面に出し分ける必要がある失敗理由 */
  type TotpEnrollmentFailureReason =
    /** 確認コードが誤り。QRコードはそのままで再入力できる */
    | "invalid-verification-code"
    | "already-enrolled"
    | "signed-out"
    | "requires-recent-login"
    | "totp-not-enabled"
    | "too-many-requests"
    | "configuration-error"
    | "network-error"
    | "unknown";

  type TotpEnrollmentResult = { ok: true } | { ok: false; reason: TotpEnrollmentFailureReason };

  /** 検証の失敗のうち、A3に留まってメッセージとして出すもの(他画面へ移すものを除く) */
  type TotpEnrollmentDisplayFailureReason = Exclude<
    TotpEnrollmentFailureReason,
    "signed-out" | "already-enrolled"
  >;

  /**
   * A3が表示に使う状態。
   * 登録開始の結果と、検証成功後の完了表示をひとまとめに扱う。
   */
  type MfaSetupState =
    | { status: "loading" }
    | { status: "ready"; secret: TotpSecret; qrCodeUrl: string }
    /** 検証成功。続けてリカバリーコードを発行している */
    | { status: "issuing-recovery-codes" }
    /** 検証成功かつリカバリーコード発行済み。ユーザーが「開始する」を押すまでこの画面に留まる */
    | { status: "enrolled"; codes: string[] }
    /** 検証は成功したがリカバリーコードを発行できなかった。2FA自体は有効になっている */
    | {
        status: "recovery-codes-failed";
        reason: Exclude<MfaRecoveryIssueFailureReason, "signed-out">;
      }
    | { status: "start-failed"; reason: TotpEnrollmentStartFailureReason };

  /**
   * A4ログインフォームの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type LoginFormValues = z.infer<typeof loginSchema>;

  /**
   * A4ログインで画面に出し分ける必要がある失敗理由。
   * Firebaseのエラーコードをそのまま画面に持ち込まないための境界。
   */
  type SignInFailureReason =
    /**
     * メールアドレスかパスワードが誤り。どちらが誤りかは区別しない
     * (区別すると未登録のメールアドレスを外部から判定できてしまう)。
     */
    | "invalid-credential"
    /** 管理コンソール等でアカウントが無効化されている */
    | "user-disabled"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  /**
   * 一次認証の通過後に進む先。
   *
   * 2FAは全ユーザー必須(docs/auth-login-requirements.md 3.3)のため、
   * 通常のログインは`mfa-verify`に落ちる。残り2つはサインアップを途中で離脱した
   * アカウントの復帰経路で、未完了の手順まで戻す。
   */
  type SignInNextStep =
    /** 2FA登録済み。確認コードの検証が要る(A5) */
    | "mfa-verify"
    /** メールアドレスが未確認。確認を待つ(A2) */
    | "email-unverified"
    /** メール確認済みだが2FAが未登録。登録を強制する(A3) */
    | "mfa-setup";

  type SignInResult =
    { ok: true; next: SignInNextStep } | { ok: false; reason: SignInFailureReason };

  /**
   * 一次認証を通過し、二次認証(A5)の完了を待っているログイン。
   *
   * `resolver`はFirebaseが発行する検証セッションそのもので、A5はこれを使って
   * 確認コードを検証する。関数を含みJSONへ直列化できないため、`sessionStorage`等ではなく
   * メモリ上で受け渡す(`src/lib/auth/pending-login.ts`)。
   */
  type PendingLogin = {
    resolver: MultiFactorResolver;
    /** A5の「一次認証済みのメールアドレス(確認表示)」に使う */
    email: string;
    /**
     * A4で入力されたパスワード。A5の「リカバリーコードを使う」でのみ使う。
     *
     * リカバリーコードの検証はCloud Functionsで行い、その際に一次認証の通過を
     * サーバー側で確かめる必要がある(A5の時点ではまだサインインしておらず、
     * IDトークンで本人確認ができない)。ユーザーにA5で再入力させずに済ませるため、
     * resolverと同じくメモリ上でのみ引き継ぐ(永続化しない)。
     *
     * Googleログイン(A8経由を含む)ではパスワードが無いため`undefined`になり、
     * A5は「リカバリーコードを使う」導線を出さない。
     */
    password?: string;
    /** A4の「ログイン状態を保持する」の選択。A5が検証成功時のセッション永続化に使う */
    rememberMe: boolean;
  };

  /**
   * A5の確認コード検証で画面に出し分ける必要がある失敗理由。
   * Firebaseのエラーコードをそのまま画面に持ち込まないための境界。
   */
  type MfaVerificationFailureReason =
    /** 確認コードが誤り。検証セッションは有効なままなので再入力できる */
    | "invalid-verification-code"
    /** 検証セッションが期限切れ・不正。A5では解決できないためA4からやり直す */
    | "session-expired"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  type MfaVerificationResult = { ok: true } | { ok: false; reason: MfaVerificationFailureReason };

  /**
   * Cloud Functions(callable)の失敗のうち、バックエンドの理由に依らず決まるもの
   * (`src/lib/auth/callable-error.ts`)。どの呼び出しでも起こりうるため共通で持つ。
   */
  type CallableSharedFailureReason =
    | "configuration-error"
    /** callableに到達できない・サーバー側で処理しきれなかった */
    | "unavailable"
    | "unknown";

  /**
   * A3(登録完了時)・B10(再発行)でリカバリーコードを発行できなかった理由。
   *
   * 発行はCloud Functions(callable)で行うため、失敗理由はFirebaseのエラーコードと、
   * バックエンドが`details.reason`に載せた値から決める
   * (`src/lib/auth/mfa-recovery.ts`、src/backend/src/mfa-recovery/functions.ts)。
   */
  type MfaRecoveryIssueFailureReason =
    /** セッションが無い(直接アクセス・サインアウト済み) */
    | "signed-out"
    /** メールアドレスが未確認。2FA登録自体の前提を満たしていない */
    | "email-unverified"
    /** 2FA(TOTP)が未登録。リカバリーコードだけ先に発行することはできない */
    | "mfa-not-enrolled"
    /**
     * 有効なコードが残っている状態での発行(=B10の再発行)なのに、
     * 本人確認のパスワードが渡らなかった。A3の初回発行では起きない
     */
    | "password-required"
    /** 本人確認のパスワードが誤り */
    | "invalid-credential"
    | "too-many-requests"
    | CallableSharedFailureReason;

  /** B10でリカバリーコードの発行状況を取得できなかった理由 */
  type MfaRecoveryStatusFailureReason = "signed-out" | CallableSharedFailureReason;

  /**
   * リカバリーコードの発行状況(B10の表示用)。
   * Firestoreを直接読めないためcallableの応答から受け取る(平文もハッシュも含まない)。
   */
  type MfaRecoveryStatus = {
    /** 未発行なら`null`。それ以外はエポックミリ秒 */
    generatedAt: number | null;
    /** 未使用のコードの本数 */
    remainingCodes: number;
    /** 発行済みのコードの総数 */
    totalCodes: number;
  };

  type MfaRecoveryStatusResult =
    { ok: true; status: MfaRecoveryStatus } | { ok: false; reason: MfaRecoveryStatusFailureReason };

  /**
   * B10で2FA(TOTP)の登録を解除できなかった理由
   * (`src/lib/auth/mfa-reset.ts`、src/backend/src/mfa-recovery/functions.ts)。
   */
  type MfaResetFailureReason =
    /** セッションが無い(直接アクセス・サインアウト済み) */
    | "signed-out"
    /** 2FAが登録されていない。解除するものが無い */
    | "mfa-not-enrolled"
    /** 本人確認のパスワードが渡らなかった */
    | "password-required"
    /** 本人確認のパスワードが誤り */
    | "invalid-credential"
    | "too-many-requests"
    /** 本人確認は通ったが、Identity Platform側で解除できなかった */
    | "unenroll-failed"
    | CallableSharedFailureReason;

  type MfaResetResult = { ok: true } | { ok: false; reason: MfaResetFailureReason };

  /**
   * リカバリーコードの発行結果。
   * `codes`は表示形(`XXXX-XXXX`)の平文で、この応答以降どこからも取得できない。
   */
  type MfaRecoveryIssueResult =
    { ok: true; codes: string[] } | { ok: false; reason: MfaRecoveryIssueFailureReason };

  /** A5でリカバリーコードによる2FA解除に失敗した理由 */
  type MfaRecoveryUseFailureReason =
    /** リカバリーコードが誤り、または既に使用済み */
    | "invalid-recovery-code"
    /** 一次認証の再確認に失敗した(パスワードの誤り・アカウント無効化) */
    | "invalid-credential"
    /** 未使用のリカバリーコードが1本も無い */
    | "no-recovery-codes"
    /** 2FAが登録されていない。解除するものが無く、通常のログインで進める */
    | "mfa-not-enrolled"
    /**
     * 入力したコードは使用済みになったが、2FAの解除に失敗した。
     * 使ったコードは戻らないため、残っている別のコードで試し直してもらう
     */
    | "unenroll-failed"
    | "too-many-requests"
    | "configuration-error"
    /** callableに到達できない・サーバー側で処理しきれなかった */
    | "unavailable"
    | "unknown";

  /**
   * リカバリーコードによる2FA解除の結果。
   * `remainingCodes`は消費後に残っている未使用コードの本数。
   */
  type MfaRecoveryUseResult =
    { ok: true; remainingCodes: number } | { ok: false; reason: MfaRecoveryUseFailureReason };

  /** A5の入力方法。認証アプリの確認コードと、リカバリーコードを切り替える */
  type MfaVerifyMode = "totp" | "recovery";

  /**
   * A1・A4の「Googleで続ける」で画面に出し分ける必要がある失敗理由
   * (docs/screen-requirements-auth.md 2章)。
   */
  type GoogleSignInFailureReason =
    /**
     * ユーザーがポップアップを閉じた・別のポップアップに置き換えられた。
     * 失敗ではなく取りやめのため、画面はエラーを出さず元の状態に戻す
     */
    | "popup-closed"
    /** ブラウザにポップアップを塞がれた。ユーザーの操作で解消できるため専用の文言を出す */
    | "popup-blocked"
    /** Identity Platform側でGoogleプロバイダが有効化されていない(docs/ci-cd-setup.md 10章) */
    | "provider-disabled"
    /** 現在のホストが承認済みドメインに登録されていない(同 10.3) */
    | "unauthorized-domain"
    /** 管理コンソール等でアカウントが無効化されている */
    | "user-disabled"
    /**
     * 承認されていないメールアドレスで**新規アカウントを作ろうとした**
     * (ベータ期間中の招待制。docs/auth-login-requirements.md 3.10)。
     * Google側ではサインアップとログインを区別できないため、A4から押した場合も起こる
     */
    | "signup-not-allowed"
    /** 許可リストを確かめられずに拒否された(同 fail-closed)。時間をおけば通りうる */
    | "signup-check-unavailable"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  /**
   * Googleログインの通過後に進む先。
   *
   * `link-account`以外はA4からの経路と同じ(`SignInNextStep`)。Googleのメールアドレスは
   * Google側で確認済みのため、通常`email-unverified`にはならない。
   */
  type GoogleSignInNextStep =
    | SignInNextStep
    /** 同一メールアドレスのパスワードアカウントが既にある。連携が要る(A8) */
    | "link-account";

  type GoogleSignInResult =
    { ok: true; next: GoogleSignInNextStep } | { ok: false; reason: GoogleSignInFailureReason };

  /**
   * 画面にメッセージを出す必要があるGoogleログインの失敗理由。
   * ポップアップの取りやめはエラー表示しないため除く(docs/screen-requirements-auth.md 2章)。
   */
  type GoogleSignInDisplayFailureReason = Exclude<GoogleSignInFailureReason, "popup-closed">;

  /**
   * A8での連携を待っているGoogleの資格情報。
   *
   * `credential`は短命なOAuthクレデンシャルで、永続化すると期限切れの資格情報で連携を
   * 試みることになるため、`pending-login.ts`と同じくメモリ上でのみ受け渡す
   * (docs/auth-login-requirements.md 3.8、`src/lib/auth/pending-google-link.ts`)。
   */
  type PendingGoogleLink = {
    credential: OAuthCredential;
    /** Googleから取得したメールアドレス。A8の確認表示とパスワード検証の両方に使う */
    email: string;
    /** A1・A4での「ログイン状態を保持する」の選択。A8のパスワード検証へ引き継ぐ */
    rememberMe: boolean;
  };

  /**
   * A8アカウント連携フォームの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type AccountLinkFormValues = z.infer<typeof accountLinkSchema>;

  /** GoogleのブランドマークのProps。大きさだけ呼び出し側で変えられるようにする */
  type GoogleIconProps = {
    /** Tailwindのサイズ指定。省略時はボタン内に置く前提の`size-4` */
    className?: string;
  };

  /** A1・A4共通の「Googleで続ける」ボタンのProps(docs/screen-requirements-auth.md 2章) */
  type GoogleSignInButtonProps = {
    /**
     * 「ログイン状態を保持する」の選択。A4はフォームの現在値を渡す。
     * A1にはこの選択が無いため、省略時はA4の既定と揃えて保持する
     */
    rememberMe?: boolean;
    /**
     * 押下させない理由(A1の規約未同意)。渡すとボタンを無効化し、理由をボタンの下に出す。
     * ポップアップを開いてから断るより、開く前に条件が分かる方が親切なため
     */
    blockedReason?: string;
  };

  /**
   * A6パスワードをお忘れの方フォームの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

  /**
   * A6のリセットメール送信で画面に出し分ける必要がある失敗理由。
   *
   * 未登録のメールアドレス・パスワード未設定(Googleのみ)のアカウントはここに現れない。
   * アカウントの存在有無を伏せるため、`src/lib/auth/password-reset.ts`が成功として返すため。
   * 残るのはリクエストがFirebaseに届かなかった場合と、要求した本人の試行回数による制限。
   */
  type PasswordResetFailureReason =
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  type PasswordResetResult = { ok: true } | { ok: false; reason: PasswordResetFailureReason };

  /**
   * A7パスワード再設定フォームの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  /**
   * メール内リンクのワンタイムコード(oobCode)を扱えなかった理由。
   * Firebaseのエラーコードをそのまま画面に持ち込まないための境界(`src/lib/auth/action-code.ts`)。
   */
  type ActionCodeFailureReason =
    /**
     * リンクが無効・期限切れ・使用済み。A7では解決できないため、A6から取り直してもらう。
     * リンクの持ち主のアカウントが削除されている場合も、利用者から見た対処は同じなのでここに含める
     */
    | "invalid-action-code"
    /** 管理コンソール等でアカウントが無効化されている */
    | "user-disabled"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  /** A7でリセットリンク(oobCode)を検証できなかった理由 */
  type PasswordResetCodeFailureReason = ActionCodeFailureReason;

  /**
   * リセットリンクの検証結果。
   * `email`は「どのアカウントのパスワードを変更するのか」の確認表示に使う。
   */
  type PasswordResetCodeResult =
    { ok: true; email: string } | { ok: false; reason: PasswordResetCodeFailureReason };

  /** A7で新しいパスワードを確定できなかった理由 */
  type PasswordResetConfirmFailureReason =
    /** 検証を通ったあとにリンクが失効した(別タブで使用済み・有効期限切れ) */
    | "invalid-action-code"
    /** Identity Platform側のパスワードポリシーで弾かれた */
    | "password-policy-violation"
    | "user-disabled"
    | "too-many-requests"
    | "configuration-error"
    /** リクエストがFirebaseに届かない */
    | "network-error"
    | "unknown";

  type PasswordResetConfirmResult =
    { ok: true } | { ok: false; reason: PasswordResetConfirmFailureReason };

  /**
   * 再設定の失敗のうち、特定の入力項目にもリンクの状態にも紐づかず、
   * フォーム全体のエラーとして表示するもの。
   */
  type PasswordResetConfirmFormLevelFailureReason = Extract<
    PasswordResetConfirmFailureReason,
    "too-many-requests" | "configuration-error" | "network-error" | "unknown"
  >;

  /** A7が表示に使う状態。リンクの検証結果と、再設定完了後の表示をひとまとめに扱う */
  type ResetPasswordState =
    /** リンクを検証中。入力欄はまだ出さない */
    | { status: "verifying" }
    /** リンクが有効。`email`は変更対象のアカウントの確認表示に使う */
    | { status: "ready"; email: string }
    /** リンクが使えない。A7では解決できないためA6への導線を出す */
    | { status: "link-error"; reason: PasswordResetCodeFailureReason }
    /** 再設定完了。完了メッセージを出したのちA4へ遷移する */
    | { status: "completed" };

  /**
   * A7パスワード再設定フォームのProps。
   * `oobCode`はリセットメールのリンクに含まれるワンタイムコード(欠落時はnull)。
   */
  type ResetPasswordFormProps = {
    oobCode: string | null;
  };

  /** メールアドレス確認リンク(`mode=verifyEmail`)を適用できなかった理由 */
  type EmailVerificationApplyFailureReason = ActionCodeFailureReason;

  type EmailVerificationApplyResult =
    { ok: true } | { ok: false; reason: EmailVerificationApplyFailureReason };

  /** メールアドレス確認リンクを適用する画面の状態 */
  type EmailVerificationApplyState =
    | { status: "applying" }
    | { status: "applied" }
    | { status: "failed"; reason: EmailVerificationApplyFailureReason };

  /** メールアドレス確認リンクを適用する画面のProps */
  type VerifyEmailActionNoticeProps = {
    oobCode: string | null;
  };

  /**
   * アクションURL(`/auth/action`)が`mode`から決める振る舞い。
   * FIRE-FIREが送るメールはパスワード再設定と確認メールの2種類のみで、
   * それ以外(`recoverEmail`等)は`unsupported`として案内だけを出す。
   */
  type EmailActionTarget =
    /** A7へ引き渡す。`path`は`oobCode`を引き継いだ遷移先 */
    | { kind: "reset-password"; path: string }
    /** その場でメールアドレスの確認を適用する */
    | { kind: "verify-email"; oobCode: string | null }
    | { kind: "unsupported" };

  /** 発行したリカバリーコードの一覧表示のProps(A3。B10の再発行でも使う想定) */
  type RecoveryCodeListProps = {
    /** 表示形(`XXXX-XXXX`)の平文コード */
    codes: string[];
  };

  /** A3のQRコード表示のProps */
  type TotpQrCodeProps = {
    /** `otpauth://`形式のURL(Firebaseの`TotpSecret.generateQrCodeUrl()`の戻り値) */
    url: string;
  };

  /** 表示/非表示を切り替えられるパスワード入力欄のProps */
  type PasswordFieldProps = {
    /** input要素のid。ラベルとの紐付けに使う */
    id: string;
    label: string;
    /** react-hook-formの`register()`の戻り値 */
    registration: UseFormRegisterReturn;
    /**
     * ブラウザ/パスワードマネージャーへの用途の伝え方。
     * 既定は新規設定用(A1・A7)。ログイン(A4)は`current-password`を渡す。
     */
    autoComplete?: "new-password" | "current-password";
    /** 対応する項目のバリデーションエラー(未エラー時はundefined) */
    error?: FieldError;
    /** エラーメッセージの下に差し込む補助表示(パスワードポリシーの充足一覧など) */
    children?: ReactNode;
  };

  /**
   * ログイン後画面(B1〜B11)を表示してよいかの判定結果。
   * `ready`以外はいずれも認証フローの未完了で、対応する認証系画面へ戻す。
   */
  type ResolvedAppAccessState = "signed-out" | "email-unverified" | "mfa-required" | "ready";

  /**
   * ガード側が持つ状態。Firebaseはセッションをブラウザ側に持つため、
   * 復元が終わるまでは「未ログイン」と区別できない`checking`を挟む。
   * `configuration-error`はFirebaseの設定値不足で、認証状態を問い合わせることすらできない状態。
   */
  type AppAccessState = ResolvedAppAccessState | "checking" | "configuration-error";

  /** 画面へ進ませずに認証系画面へ戻す状態 */
  type AppAccessRedirectState = Exclude<ResolvedAppAccessState, "ready">;

  /**
   * ログアウト(`signOut()`)に失敗した理由(docs/screen-requirements-account.md 2章)。
   * `signOut()`はローカルのセッション破棄が主で、失敗はほぼ通信断か原因不明のいずれかに絞られる。
   */
  type SignOutFailureReason = "network-error" | "unknown";

  type SignOutResult = { ok: true } | { ok: false; reason: SignOutFailureReason };

  /**
   * ログアウト確認ダイアログのProps(共通ヘッダー・A2・A3で共通のコンポーネント)。
   *
   * 見出し・ボタン・実行内容は呼び出し元によらず同一で、注記の文言だけを`variant`で出し分ける
   * (docs/screen-requirements-account.md 2章の表)。A2・A3の時点ではTOTPが未登録で
   * 「再ログインには確認コードが必要」が事実と異なるため、共通ヘッダー版とは別の注記にする。
   */
  type LogoutConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** ログアウトの実行。キャッシュ初期化の要否は呼び出し元ごとに異なるため関数で受け取る */
    onConfirm: () => Promise<SignOutResult>;
  } & (
    | { variant: "header" }
    | {
        variant: "auth-flow";
        /** A2は「メールアドレスの確認」、A3は「2FAの登録」が未完了である旨を伝える */
        pendingStep: Extract<AppAccessRedirectState, "email-unverified" | "mfa-required">;
      }
  );
}
