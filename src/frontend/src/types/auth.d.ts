import type { TotpSecret } from "firebase/auth";
import type { ReactNode } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

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
    /** 対応する項目のバリデーションエラー(未エラー時はundefined) */
    error?: FieldError;
    /** エラーメッセージの下に差し込む補助表示(パスワードポリシーの充足一覧など) */
    children?: ReactNode;
  };
}
