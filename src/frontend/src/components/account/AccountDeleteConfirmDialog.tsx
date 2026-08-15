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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ACCOUNT_DELETION_DIALOG_CONFIRM_LABEL,
  ACCOUNT_DELETION_DIALOG_DESCRIPTION,
  ACCOUNT_DELETION_DIALOG_EMAIL_LABEL,
  ACCOUNT_DELETION_DIALOG_SUBMITTING_LABEL,
  ACCOUNT_DELETION_DIALOG_TITLE,
  PASSWORD_CONFIRM_CANCEL_LABEL,
  PASSWORD_CONFIRM_FIELD_LABEL,
} from "@/constants/account";
import { accountDeletionSchema } from "@/schemas/account";

import type { JSX } from "react";

/**
 * B10のアカウント削除の確認ダイアログ(docs/auth-login-requirements.md 3.11)。
 *
 * `PasswordConfirmDialog`と分けてある。入力がパスワードだけではなく、**登録メールアドレスの
 * 入力も求める**ため。他の後戻りできない操作(2FA再設定・リカバリーコード再発行・パスワード
 * 解除)と違い、削除は復旧できないので確認の強度を1段上げている(PO判断)。
 *
 * **入力の一致はここでは判定しない。** 画面は登録メールアドレスを持っているが、照合は
 * サーバー側(`deleteAccount`)が行う。画面だけで判定すると、UIを通さない呼び出しが
 * 確認を素通りできてしまう。ここで落とすのは未入力だけにする。
 *
 * 失敗した場合はダイアログを閉じずにその場でエラーを出す(`PasswordConfirmDialog`と同じ方針)。
 */
export const AccountDeleteConfirmDialog = ({
  open,
  onOpenChange,
  email,
  onConfirm,
}: AccountDeleteConfirmDialogProps): JSX.Element => {
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountDeletionFormValues>({
    resolver: zodResolver(accountDeletionSchema),
    defaultValues: { password: "", confirmEmail: "" },
  });

  const handleOpenChange = (next: boolean): void => {
    // 通信中はEscapeキー等での中断を無視する。**削除の結果が分からないまま閉じさせない**
    if (isSubmitting) {
      return;
    }

    reset();
    setFailureMessage(null);
    onOpenChange(next);
  };

  const handleConfirm = handleSubmit(async (values): Promise<void> => {
    setFailureMessage(null);

    const message = await onConfirm(values);

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
          <AlertDialogTitle>{ACCOUNT_DELETION_DIALOG_TITLE}</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>{ACCOUNT_DELETION_DIALOG_DESCRIPTION}</AlertDialogDescription>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="account-deletion-email">
              {ACCOUNT_DELETION_DIALOG_EMAIL_LABEL}
            </FieldLabel>
            <Input
              id="account-deletion-email"
              type="email"
              // 入力させたい値そのものを placeholder に出す。取り違えて別のアドレスを
              // 入れたまま何度も弾かれるのを避ける
              placeholder={email ?? undefined}
              autoComplete="username"
              aria-invalid={errors.confirmEmail !== undefined}
              {...register("confirmEmail")}
            />
            <FieldError errors={[errors.confirmEmail]} />
          </Field>

          <PasswordField
            id="account-deletion-password"
            label={PASSWORD_CONFIRM_FIELD_LABEL}
            registration={register("password")}
            autoComplete="current-password"
            error={errors.password}
          />

          {failureMessage === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {failureMessage}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {PASSWORD_CONFIRM_CANCEL_LABEL}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting
                ? ACCOUNT_DELETION_DIALOG_SUBMITTING_LABEL
                : ACCOUNT_DELETION_DIALOG_CONFIRM_LABEL}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
};
