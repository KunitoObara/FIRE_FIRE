"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LOGOUT_DIALOG_AUTH_FLOW_NOTES,
  LOGOUT_DIALOG_CANCEL_LABEL,
  LOGOUT_DIALOG_CONFIRM_LABEL,
  LOGOUT_DIALOG_HEADER_NOTE,
  LOGOUT_DIALOG_TITLE,
  SIGN_OUT_MESSAGES,
} from "@/constants/auth";
import { LOGIN_PATH } from "@/constants/routes";

import type { JSX, MouseEvent } from "react";

/**
 * ログアウトの確認ダイアログ(docs/screen-requirements-account.md 2章)。
 *
 * 共通ヘッダーのユーザーメニュー(B1〜B10)と、A2・A3の「別のアカウントでログイン」で
 * 同じコンポーネントを使う。見出し・ボタン・実行内容は呼び出し元によらず同一で、注記の文言だけを
 * `variant`で出し分ける(A2・A3はTOTP未登録のため、共通ヘッダー版の「確認コードが必要」が
 * 事実と異なる)。
 *
 * 「ログアウトする」押下でこのコンポーネント自身が`onConfirm`を実行する。失敗した場合は
 * ダイアログを閉じずその場でエラーを表示し、再試行できるようにする。中途半端にA4へ遷移させると、
 * サインイン状態のままログイン画面を見せることになるため。
 */
export const LogoutConfirmDialog = (props: LogoutConfirmDialogProps): JSX.Element => {
  const { open, onOpenChange, onConfirm } = props;
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failureReason, setFailureReason] = useState<SignOutFailureReason | null>(null);

  const note =
    props.variant === "header"
      ? LOGOUT_DIALOG_HEADER_NOTE
      : LOGOUT_DIALOG_AUTH_FLOW_NOTES[props.pendingStep];

  const handleOpenChange = (next: boolean): void => {
    // 通信中はEscapeキー等での中断を無視する。処理の結果が分からないまま画面遷移させないため
    if (isSubmitting) {
      return;
    }
    setFailureReason(null);
    onOpenChange(next);
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    // `AlertDialogAction`はRadixの`Dialog.Close`そのもので、既定では押下と同時に閉じる。
    // 失敗時はダイアログを開いたままエラーを表示したいため、既定の自動クローズを止め、
    // 成功したときだけ`router.replace`で自分から遷移する
    event.preventDefault();
    setIsSubmitting(true);
    setFailureReason(null);

    const result = await onConfirm();

    if (!result.ok) {
      setIsSubmitting(false);
      setFailureReason(result.reason);
      return;
    }

    // 一次認証済みの画面に戻る意味はないため、履歴を残さず置き換える
    // (戻ってもガードがA4へ差し戻すだけになる。account.md 2章)
    router.replace(LOGIN_PATH);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{LOGOUT_DIALOG_TITLE}</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>{note}</AlertDialogDescription>

        {failureReason !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {SIGN_OUT_MESSAGES[failureReason]}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {LOGOUT_DIALOG_CANCEL_LABEL}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "ログアウト中..." : LOGOUT_DIALOG_CONFIRM_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
