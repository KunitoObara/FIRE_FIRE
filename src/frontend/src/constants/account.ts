/** B10 アカウント設定画面で使う定数(docs/screen-requirements-account.md B10) */

import {
  FIREBASE_CONFIGURATION_MESSAGE,
  FIREBASE_NETWORK_ERROR_MESSAGE,
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

/** 「ログイン方法」セクション(docs/screen-requirements-account.md「連携アカウントの管理」) */
export const LINKED_ACCOUNTS_TITLE = "ログイン方法";
export const LINKED_ACCOUNTS_DESCRIPTION =
  "このアカウントにログインできる方法です。最後の1つは解除できません。";

export const LINKED_PROVIDER_LABELS: Record<LinkedProviderId, string> = {
  password: "メールアドレス / パスワード",
  "google.com": "Google",
};

export const LINKED_PROVIDER_LINKED_LABEL = "連携済み";
export const LINKED_PROVIDER_NOT_LINKED_LABEL = "未連携";
export const LINK_GOOGLE_LABEL = "Googleと連携する";
export const LINK_GOOGLE_SUBMITTING_LABEL = "Googleで認証中...";
export const UNLINK_PROVIDER_LABEL = "解除";

/**
 * 解除ボタンの読み上げ名。
 * 行が複数あり、見た目の「解除」だけではどのログイン方法を指すのか音声では区別できないため。
 */
export const buildUnlinkProviderButtonLabel = (providerId: LinkedProviderId): string =>
  `${LINKED_PROVIDER_LABELS[providerId]}の連携を解除`;

/** 解除ボタンを無効化したときに併記する理由 */
export const LAST_PROVIDER_NOTICE = "唯一のログイン方法のため解除できません";

/**
 * ログイン通知メールの宛先についての注記。
 *
 * 連携するGoogleアカウントは登録メールアドレスと違ってよいが、通知([auth-login-requirements.md]
 * 3.6)の宛先は登録メールアドレスのまま変わらない。連携前から見えるよう、連携状況によらず出す。
 */
export const LINKED_ACCOUNTS_NOTIFICATION_NOTICE =
  "ログイン通知メールの宛先は、連携したGoogleアカウントのメールアドレスではなく登録メールアドレスのままです。";

export const GOOGLE_LINKED_MESSAGE =
  "Googleアカウントを連携しました。次回からGoogleでもログインできます。";

export const buildProviderUnlinkedMessage = (providerId: LinkedProviderId): string =>
  `${LINKED_PROVIDER_LABELS[providerId]}での連携を解除しました。`;

/**
 * 連携解除の確認ダイアログの文言。
 *
 * パスワードだけ、解除するとログイン手段以外に失うものがある旨を書き足している。
 * パスワードの再確認を伴う操作(2FAの再設定・リカバリーコードの発行・A5でのリカバリーコード
 * 使用)はパスワードを持たないアカウントでは実行できず、しかもこのアプリにはパスワードを
 * 後から設定し直す導線が無いため(docs/auth-login-requirements.md 8章のオープン課題)。
 * 認証アプリを失ったときの復旧手段まで一緒に手放すことになるので、実行前に伝える。
 */
export const UNLINK_PROVIDER_DIALOG_TEXTS: Record<
  LinkedProviderId,
  { title: string; description: string }
> = {
  password: {
    title: "メールアドレス / パスワードでのログインを解除しますか?",
    description:
      "解除するとパスワードではログインできなくなり、Googleでのログインのみになります。パスワードを後から設定し直すことはできず、2FAの再設定・リカバリーコードの発行・リカバリーコードでの復旧も使えなくなります。",
  },
  "google.com": {
    title: "Googleとの連携を解除しますか?",
    description:
      "解除するとGoogleではログインできなくなります。メールアドレスとパスワードでのログインは引き続きご利用いただけます。",
  },
};

export const UNLINK_PROVIDER_CONFIRM_LABEL = "解除する";
export const UNLINK_PROVIDER_SUBMITTING_LABEL = "解除中...";
export const UNLINK_PROVIDER_CANCEL_LABEL = "キャンセル";

/**
 * パスワード解除の本人確認ダイアログの文言
 * (docs/screen-requirements-account.md「メールアドレス / パスワードの解除」)。
 *
 * 失うものの説明は確認ダイアログと同じ文面を使い、本人確認を求める一文だけを足す。
 * 同じ操作の説明を2つ持つと、片方だけが直されて食い違うため。
 */
export const UNLINK_PASSWORD_DIALOG_DESCRIPTION = `${UNLINK_PROVIDER_DIALOG_TEXTS.password.description}本人確認のため、パスワードを再入力してください。`;
export const UNLINK_PASSWORD_CONFIRM_LABEL = "確認して解除する";

/** Googleを連携できなかったときのメッセージ */
export const LINK_GOOGLE_MESSAGES: Record<LinkGoogleDisplayFailureReason, string> = {
  "popup-blocked":
    "ポップアップがブロックされました。ブラウザの設定でポップアップを許可してから再度お試しください。",
  "credential-already-in-use":
    "このGoogleアカウントは別のアカウントで既に使用されています。別のGoogleアカウントで連携してください。",
  "provider-already-linked": "このアカウントには既にGoogleが連携されています。",
  "requires-recent-login":
    "セキュリティのため、ログインし直してから連携してください。いったんログアウトして再度ログインすると実行できます。",
  "signed-out": ACCOUNT_SIGNED_OUT_MESSAGE,
  "provider-disabled":
    "Googleログインが有効になっていません。Firebaseコンソールで設定を確認してください。",
  "unauthorized-domain":
    "このドメインからのGoogleログインは許可されていません。Firebaseコンソールの承認済みドメインを確認してください。",
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unknown: "Googleアカウントを連携できませんでした。時間をおいて再度お試しください。",
};

/** ログイン方法を解除できなかったときのメッセージ */
export const UNLINK_PROVIDER_MESSAGES: Record<UnlinkProviderFailureReason, string> = {
  // 画面はボタンを無効化して防ぐため、通常はここに来ない
  "last-provider": "唯一のログイン方法のため解除できません。",
  "not-linked": "このログイン方法は連携されていません。画面を開き直してください。",
  "requires-recent-login":
    "セキュリティのため、ログインし直してから解除してください。いったんログアウトして再度ログインすると実行できます。",
  "signed-out": ACCOUNT_SIGNED_OUT_MESSAGE,
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "network-error": FIREBASE_NETWORK_ERROR_MESSAGE,
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unknown: "連携を解除できませんでした。時間をおいて再度お試しください。",
};

/**
 * パスワードでのログインを解除できなかったときのメッセージ。
 *
 * 解除はCloud Functionsで行うため、Googleの解除とは失敗の出方が違う
 * (`UNLINK_PROVIDER_MESSAGES`)。本人確認の失敗が加わり、ポップアップ・再認証は起きない。
 */
export const UNLINK_PASSWORD_MESSAGES: Record<UnlinkPasswordFailureReason, string> = {
  "signed-out": ACCOUNT_SIGNED_OUT_MESSAGE,
  "not-linked": "パスワードでのログインは設定されていません。画面を開き直してください。",
  // 画面はボタンを無効化して防ぐため、通常はここに来ない
  "last-provider": "唯一のログイン方法のため解除できません。",
  // ダイアログが未入力を弾くため、通常はここに来ない
  "password-required": "パスワードを入力してください。",
  "invalid-credential": "パスワードが正しくありません。",
  "too-many-requests": TOO_MANY_REQUESTS_MESSAGE,
  "unlink-failed": "パスワードでのログインを解除できませんでした。時間をおいて再度お試しください。",
  "configuration-error": FIREBASE_CONFIGURATION_MESSAGE,
  unavailable: "パスワードでのログインを解除できませんでした。時間をおいて再度お試しください。",
  unknown: "パスワードでのログインを解除できませんでした。時間をおいて再度お試しください。",
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
