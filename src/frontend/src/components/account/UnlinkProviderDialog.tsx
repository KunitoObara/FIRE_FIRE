"use client";

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
  UNLINK_PROVIDER_CANCEL_LABEL,
  UNLINK_PROVIDER_CONFIRM_LABEL,
  UNLINK_PROVIDER_DIALOG_TEXTS,
  UNLINK_PROVIDER_MESSAGES,
  UNLINK_PROVIDER_SUBMITTING_LABEL,
} from "@/constants/account";

import type { JSX, MouseEvent } from "react";

/**
 * 連携解除の確認ダイアログ(docs/screen-requirements-account.md「連携アカウントの管理」)。
 *
 * 解除は元に戻せる操作(連携し直せる)なのでパスワードの再入力までは求めず、確認だけを挟む。
 * ただしパスワードの解除だけは戻す導線が無いため、文言側でその旨を伝える
 * (`UNLINK_PROVIDER_DIALOG_TEXTS`)。
 *
 * 失敗した場合はダイアログを閉じずにその場でエラーを出す(`DeleteCategoryAxisDialog`と同じ方針)。
 */
export const UnlinkProviderDialog = ({
  provider,
  onOpenChange,
  onConfirm,
}: UnlinkProviderDialogProps): JSX.Element => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (next: boolean): void => {
    // 通信中はEscapeキー等での中断を無視する。結果が分からないまま閉じさせないため
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    onOpenChange(next);
  };

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>): Promise<void> => {
    // 失敗時はダイアログを開いたままエラーを出したいため、既定の自動クローズを止める
    event.preventDefault();

    if (provider === null) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await onConfirm(provider);

    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(UNLINK_PROVIDER_MESSAGES[result.reason]);
      return;
    }

    onOpenChange(false);
  };

  return (
    <AlertDialog open={provider !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {provider === null ? "" : UNLINK_PROVIDER_DIALOG_TEXTS[provider].title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription>
          {provider === null ? "" : UNLINK_PROVIDER_DIALOG_TEXTS[provider].description}
        </AlertDialogDescription>

        {errorMessage === null ? null : (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {UNLINK_PROVIDER_CANCEL_LABEL}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting ? UNLINK_PROVIDER_SUBMITTING_LABEL : UNLINK_PROVIDER_CONFIRM_LABEL}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
