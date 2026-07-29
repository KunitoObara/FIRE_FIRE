import type { MultiFactorResolver, TotpSecret } from "firebase/auth";
import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

import type { loginSchema } from "@/schemas/login";
import type { signupSchema } from "@/schemas/signup";

// 認証(A1〜A7)関連の型。import を持つため既にモジュールであり、
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
    | "too-many-requests"
    | "configuration-error"
    | "network-error"
    | "unknown";

  type SignUpResult = { ok: true } | { ok: false; reason: SignUpFailureReason };

  /** 特定の入力項目に紐づかず、フォーム全体のエラーとして表示する失敗理由 */
  type SignUpFormLevelFailureReason = Extract<
    SignUpFailureReason,
    "too-many-requests" | "configuration-error" | "network-error" | "unknown"
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
    /** リクエストがFirebaseに届かない(ローカルではAuthエミュレータ未起動が主な原因) */
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
    /** リクエストがFirebaseに届かない(ローカルではAuthエミュレータ未起動が主な原因) */
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
    /** リクエストがFirebaseに届かない(ローカルではAuthエミュレータ未起動が主な原因) */
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
    /** 検証成功。ユーザーが「開始する」を押すまでこの画面に留まる */
    | { status: "enrolled" }
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
    /** リクエストがFirebaseに届かない(ローカルではAuthエミュレータ未起動が主な原因) */
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
    /** リクエストがFirebaseに届かない(ローカルではAuthエミュレータ未起動が主な原因) */
    | "network-error"
    | "unknown";

  type MfaVerificationResult = { ok: true } | { ok: false; reason: MfaVerificationFailureReason };

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
}
