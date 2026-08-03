/** B10 アカウント設定画面で使う定数(docs/screen-requirements-account.md B10) */

import {
  FIREBASE_CONFIGURATION_MESSAGE,
  FUNCTIONS_UNAVAILABLE_MESSAGE,
  TOO_MANY_REQUESTS_MESSAGE,
} from "@/constants/auth";

/** リカバリーコードの発行状況を引くクエリのキー。再発行後に取り直すために共有する */
export const MFA_RECOVERY_STATUS_QUERY_KEY = ["mfa-recovery-status"];

/** 「アカウント情報」セクション */
export const ACCOUNT_INFO_TITLE = "アカウント情報";
export const ACCOUNT_EMAIL_LABEL = "登録メールアドレス";
export const ACCOUNT_MFA_LABEL = "2段階認証(2FA)";
export const ACCOUNT_MFA_ENROLLED_LABEL = "有効";
export const ACCOUNT_MFA_NOT_ENROLLED_LABEL = "未設定";
/** メールアドレスを取得できなかった場合の代替表示。単一ユーザー向けのため通常は起きない */
export const ACCOUNT_EMAIL_UNKNOWN_LABEL = "取得できませんでした";

/** 「パスワード」セクション */
export const ACCOUNT_PASSWORD_TITLE = "パスワード";
export const ACCOUNT_PASSWORD_DESCRIPTION =
  "現在のパスワード入力は不要です。登録メールアドレス宛にパスワード変更用のリンクを送信します。";
export const ACCOUNT_PASSWORD_SEND_LABEL = "パスワード変更メールを送信する";
export const ACCOUNT_PASSWORD_SENDING_LABEL = "送信中...";

/**
 * リセットメールを送ったときのメッセージ。
 *
 * A6と違い宛先を伏せない。ログイン済みの本人にしか見えない画面で、
 * 送信先は画面上部に出ている登録メールアドレスそのものだと分かる方が確認しやすいため。
 */
export const buildPasswordResetSentMessage = (email: string): string =>
  `${email} 宛にパスワード変更用のメールを送信しました。メールに記載のリンクから手続きを進めてください。`;

/** 「リカバリーコード」セクション */
export const RECOVERY_CODE_TITLE = "リカバリーコード";
export const RECOVERY_CODE_DESCRIPTION =
  "認証アプリを紛失したときに、2段階認証の代わりに使う使い捨てのコードです。再発行すると以前のコードはすべて無効になります。";
export const RECOVERY_CODE_REISSUE_LABEL = "リカバリーコードを再発行する";
export const RECOVERY_CODE_ISSUE_LABEL = "リカバリーコードを発行する";
export const RECOVERY_CODE_DOWNLOAD_LABEL = "リカバリーコードをダウンロード";

/** 残り本数の表示。総数も併記して、何本使ったかが分かるようにする */
export const buildRecoveryCodeRemainingLabel = (status: MfaRecoveryStatus): string =>
  `残り ${status.remainingCodes} / ${status.totalCodes} 本`;

/** 未発行のとき。A3で発行に失敗したままB10へ来た場合にここへ入る */
export const RECOVERY_CODE_NOT_ISSUED_LABEL = "未発行";

export const buildRecoveryCodeGeneratedAtLabel = (generatedAt: string): string =>
  `発行日時: ${generatedAt}`;

/**
 * 再発行した直後の注意書き。
 * 平文が手に入るのはこの表示だけなので、A3と同じことを同じ強さで伝える。
 */
export const RECOVERY_CODE_ISSUED_NOTICE =
  "以前のリカバリーコードはすべて無効になりました。新しいコードを安全な場所に保管してください。各コードは一度だけ使用でき、この表示を閉じると再表示できません。";

export const RECOVERY_CODE_ISSUED_CLOSE_LABEL = "保管しました";

/**
 * セッションが切れていたときのメッセージ。
 * ガードがログイン画面へ送るが、遷移が反映されるまでの表示として持つ。
 */
export const ACCOUNT_SIGNED_OUT_MESSAGE =
  "ログイン状態が切れています。ログインし直してから操作してください。";

/** 発行状況を取得できなかったときのメッセージ */
export const MFA_RECOVERY_STATUS_MESSAGES: Record<MfaRecoveryStatusFailureReason, string> = {
  "signed-out": ACCOUNT_SIGNED_OUT_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: FUNCTIONS_UNAVAILABLE_MESSAGE,
  unknown: "リカバリーコードの発行状況を取得できませんでした。時間をおいて再度お試しください。",
};

/** 「2段階認証(2FA)」セクション */
export const MFA_RESET_TITLE = "2段階認証(2FA)";
export const MFA_RESET_DESCRIPTION =
  "現在の2FA設定を無効化し、新しい認証アプリで再登録します。本人確認のためパスワードの再入力が必要です。";
export const MFA_RESET_BUTTON_LABEL = "2FAを再設定する";

/** 2FA再設定の本人確認ダイアログ */
export const MFA_RESET_DIALOG_TITLE = "2FAを再設定しますか?";
export const MFA_RESET_DIALOG_DESCRIPTION =
  "現在登録済みの認証アプリとリカバリーコードは無効になり、続けて認証アプリの登録画面へ進みます。本人確認のため、パスワードを再入力してください。";
export const MFA_RESET_DIALOG_CONFIRM_LABEL = "確認して再設定する";
export const MFA_RESET_DIALOG_SUBMITTING_LABEL = "解除中...";

/**
 * リカバリーコード発行の本人確認ダイアログの文言。
 *
 * A3で発行に失敗したままB10へ来た場合(=未発行)は無効になるコードが無いため、
 * 「再発行」ではなく「発行」として案内する。本人確認を求める点はどちらも同じ。
 */
export const RECOVERY_CODE_DIALOG_TEXTS = {
  issue: {
    title: "リカバリーコードを発行しますか?",
    description: "本人確認のため、パスワードを再入力してください。",
    confirmLabel: "確認して発行する",
    submittingLabel: "発行中...",
  },
  reissue: {
    title: "リカバリーコードを再発行しますか?",
    description:
      "以前に発行したリカバリーコードはすべて使えなくなります。本人確認のため、パスワードを再入力してください。",
    confirmLabel: "確認して再発行する",
    submittingLabel: "再発行中...",
  },
};

/** 本人確認ダイアログ共通のキャンセル文言。ログアウト確認と揃える */
export const PASSWORD_CONFIRM_CANCEL_LABEL = "キャンセル";
export const PASSWORD_CONFIRM_FIELD_LABEL = "パスワード";

/**
 * 2FAを解除できなかったときのメッセージ。
 *
 * `signed-out`はガードがログイン画面へ送るが、遷移が反映されるまでの表示として文言を持つ。
 */
export const MFA_RESET_MESSAGES: Record<MfaResetFailureReason, string> = {
  "signed-out": ACCOUNT_SIGNED_OUT_MESSAGE,
  "mfa-not-enrolled": "2段階認証が登録されていません。設定画面から登録してください。",
  // 画面はパスワード未入力を先に弾くため、通常はここに来ない
  "password-required": "パスワードを入力してください。",
  "invalid-credential": "パスワードが正しくありません。",
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "unenroll-failed": "2段階認証を解除できませんでした。時間をおいて再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: FUNCTIONS_UNAVAILABLE_MESSAGE,
  unknown: "2段階認証を解除できませんでした。時間をおいて再度お試しください。",
};
