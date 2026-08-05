import type { z } from "zod";

import type { passwordConfirmSchema } from "@/schemas/account";

// アカウント設定画面(B10)関連の型。import を持つため既にモジュールであり、
// `declare global` でグローバルへ公開する。
declare global {
  /**
   * B10の本人確認で再入力するパスワードの入力値。
   * 同じ形を手で書き直すと実際の検証内容とずれるため、zodスキーマから導出する。
   */
  type PasswordConfirmFormValues = z.infer<typeof passwordConfirmSchema>;

  /**
   * B10の本人確認ダイアログのProps(docs/screen-requirements-account.md B10)。
   *
   * 「2FAを再設定する」と「リカバリーコードを再発行する」で同じコンポーネントを使う。
   * どちらも後戻りできない操作で、パスワードの再入力を求める点が同じため。
   */
  type PasswordConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** 何が起きるかの説明。実行してよいかを判断する材料になるので呼び出し元ごとに変える */
    description: string;
    confirmLabel: string;
    submittingLabel: string;
    /**
     * 入力されたパスワードで実行する。成功なら`null`、失敗なら画面に出すメッセージを返す。
     *
     * 呼び出し元ごとに失敗理由の型が違うため、理由そのものではなく文言に変換した結果を受け取る。
     * メッセージが返った場合はダイアログを閉じず、その場で再入力できるようにする。
     */
    onConfirm: (password: string) => Promise<string | null>;
  };

  /** B10のアカウント情報カードのProps */
  type AccountInfoCardProps = {
    /** ログイン中のメールアドレス。取得できない場合はnull */
    email: string | null;
    /** 2FA(TOTP)の登録状況。ガードを通っている限り必ず登録済みだが、表示は実際の状態から作る */
    isMfaEnrolled: boolean;
  };

  /** B10のパスワード変更カードのProps */
  type AccountPasswordCardProps = {
    /** リセットメールの送信先。登録メールアドレスをそのまま使う(入力欄は設けない) */
    email: string | null;
  };

  /** B10のリカバリーコードの残り本数・発行日時表示のProps */
  type RecoveryCodeStatusTextProps = {
    status: MfaRecoveryStatus;
  };

  /** B10のパスワード変更メール送信の結果として画面に出すメッセージ */
  type AccountPasswordResetFeedback = {
    kind: "success" | "error";
    message: string;
  };

  /**
   * B10で管理するログイン方法(docs/screen-requirements-account.md「連携アカウントの管理」)。
   * Firebaseの`providerId`をそのまま識別子に使い、`providerData`との突き合わせで変換を挟まない。
   */
  type LinkedProviderId = "password" | "google.com";

  /** ログイン方法1件の連携状況 */
  type LinkedProviderStatus = {
    id: LinkedProviderId;
    isLinked: boolean;
    /**
     * 連携済みのアカウントのメールアドレス。未連携・取得できない場合はnull。
     * Googleは登録メールアドレスと異なりうるため、`providerData`側の値をそのまま出す
     */
    email: string | null;
  };

  /** B10でGoogleを連携できなかった理由 */
  type LinkGoogleFailureReason =
    /** ユーザーがポップアップを閉じた。失敗ではなく取りやめのためエラーを出さない(A1・A4と同じ) */
    | "popup-closed"
    /** ブラウザにポップアップを塞がれた。ユーザーの操作で解消できるため専用の文言を出す */
    | "popup-blocked"
    /** そのGoogleアカウントが別のFIRE-FIREアカウントに既に紐付いている */
    | "credential-already-in-use"
    /** 既にGoogleが連携済み。別タブで連携した後などに起きる */
    | "provider-already-linked"
    /** サインインから時間が経ちすぎている。ログインし直せば解消する */
    | "requires-recent-login"
    /** サインインが切れている。ガードがログイン画面へ送る */
    | "signed-out"
    /** Identity Platform側でGoogleプロバイダが有効化されていない(docs/ci-cd-setup.md 10章) */
    | "provider-disabled"
    /** 現在のホストが承認済みドメインに登録されていない(同 10.3) */
    | "unauthorized-domain"
    | "too-many-requests"
    | "network-error"
    | "configuration-error"
    | "unknown";

  type LinkGoogleResult = { ok: true } | { ok: false; reason: LinkGoogleFailureReason };

  /**
   * 画面にメッセージを出す必要がある連携失敗の理由。
   * ポップアップの取りやめはエラー表示しないため除く(docs/auth-login-requirements.md 3.8)。
   */
  type LinkGoogleDisplayFailureReason = Exclude<LinkGoogleFailureReason, "popup-closed">;

  /** B10でログイン方法を解除できなかった理由 */
  type UnlinkProviderFailureReason =
    /** 最後に残った1つは解除できない。解除するとサインインする手段が無くなるため */
    | "last-provider"
    /** そのログイン方法が連携されていない。別タブで解除した後などに起きる */
    | "not-linked"
    | "requires-recent-login"
    | "signed-out"
    | "too-many-requests"
    | "network-error"
    | "configuration-error"
    | "unknown";

  type UnlinkProviderResult = { ok: true } | { ok: false; reason: UnlinkProviderFailureReason };

  /** B10の連携・解除の結果として画面に出すメッセージ */
  type LinkedAccountsFeedback = {
    kind: "success" | "error";
    message: string;
  };

  /** B10のログイン方法1行のProps */
  type LinkedProviderRowProps = {
    provider: LinkedProviderStatus;
    /**
     * 解除するとログイン方法が無くなる状態か。解除ボタンを無効化して理由を併記する
     * (docs/screen-requirements-account.md「連携アカウントの管理」の制約)
     */
    isLastProvider: boolean;
    /** Google連携のポップアップを開いている間。二重に開かせない */
    isLinking: boolean;
    onLink: () => void;
    onUnlink: (provider: LinkedProviderId) => void;
  };

  /**
   * B10の連携解除の確認ダイアログのProps。
   *
   * 解除は本人確認(パスワード再入力)ではなく確認ダイアログのみを挟む
   * (docs/screen-requirements-account.md「連携アカウントの管理」)。
   */
  type UnlinkProviderDialogProps = {
    /** 解除対象。`null`の間は閉じた状態を表す */
    provider: LinkedProviderId | null;
    onOpenChange: (open: boolean) => void;
    /** 実行結果。失敗した場合はダイアログを閉じずその場にエラーを出す */
    onConfirm: (provider: LinkedProviderId) => Promise<UnlinkProviderResult>;
  };
}
