"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PasswordField } from "@/components/auth/PasswordField";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PASSWORD_CONFIRM_CANCEL_LABEL, PASSWORD_CONFIRM_FIELD_LABEL } from "@/constants/account";
import { passwordConfirmSchema } from "@/schemas/account";

import type { JSX } from "react";

/**
 * パスワードの再入力による本人確認ダイアログ(docs/screen-requirements-account.md B10)。
 *
 * 「2FAを再設定する」と「リカバリーコードを再発行する」で共用する。どちらも実行すると
 * 元に戻せず、セッションを乗っ取られた状態で実行されると復旧手段が失われる操作のため、
 * サインイン済みであることに加えてパスワードを求める(検証はサーバー側で行う)。
 *
 * 実行結果は`onConfirm`が返すメッセージで受け取る。失敗した場合はダイアログを閉じずに
 * その場でエラーを出し、入力し直せるようにする(ログアウト確認ダイアログと同じ方針)。
 */
export const PasswordConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  submittingLabel,
  onConfirm,
}: PasswordConfirmDialogProps): JSX.Element => {
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordConfirmFormValues>({
    resolver: zodResolver(passwordConfirmSchema),
    defaultValues: { password: "" },
  });

  const handleOpenChange = (next: boolean): void => {
    // 通信中はEscapeキー等での中断を無視する。処理の結果が分からないまま閉じさせないため
    if (isSubmitting) {
      return;
    }

    // 入力したパスワードを次に開いたときまで残さない
    reset();
    setFailureMessage(null);
    onOpenChange(next);
  };

  const handleConfirm = handleSubmit(async ({ password }): Promise<void> => {
    setFailureMessage(null);

    const message = await onConfirm(password);

    if (message !== null) {
      setFailureMessage(message);
      return;
    }

    reset();
    onOpenChange(false);
  });

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>{description}</AlertDialogDescription>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <PasswordField
            id="password-confirm"
            label={PASSWORD_CONFIRM_FIELD_LABEL}
            registration={register("password")}
            autoComplete="current-password"
            error={errors.password}
          />

          {failureMessage !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {failureMessage}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {PASSWORD_CONFIRM_CANCEL_LABEL}
            </AlertDialogCancel>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
