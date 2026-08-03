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
}
