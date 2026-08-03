"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordConfirmDialog } from "@/components/account/PasswordConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MFA_RESET_BUTTON_LABEL,
  MFA_RESET_DESCRIPTION,
  MFA_RESET_DIALOG_CONFIRM_LABEL,
  MFA_RESET_DIALOG_DESCRIPTION,
  MFA_RESET_DIALOG_SUBMITTING_LABEL,
  MFA_RESET_DIALOG_TITLE,
  MFA_RESET_MESSAGES,
  MFA_RESET_TITLE,
} from "@/constants/account";
import { MFA_SETUP_PATH } from "@/constants/routes";
import { resetMfaEnrollment } from "@/lib/auth/mfa-reset";

import type { JSX } from "react";

/**
 * B10の2FA再設定(docs/screen-requirements-account.md B10)。
 *
 * 本人確認を経て現在の2FA設定を無効化し、A3と同じQRコード登録フローを再実行する。
 * この画面が行うのは解除までで、解除に成功したらA3へ送る(登録完了後はA3の導線で
 * B1へ戻る)。解除するとログイン後画面のガードも2FA未登録と判定するため、
 * 履歴を置き換えて遷移する — 戻ってもガードがA3へ差し戻すだけになるため。
 */
export const MfaResetCard = (): JSX.Element => {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConfirm = async (password: string): Promise<string | null> => {
    const result = await resetMfaEnrollment(password);

    if (!result.ok) {
      return MFA_RESET_MESSAGES[result.reason];
    }

    router.replace(MFA_SETUP_PATH);

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{MFA_RESET_TITLE}</CardTitle>
        <CardDescription>{MFA_RESET_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-start gap-4">
        <Button
          type="button"
          variant="outline"
          className="border-destructive/40 text-destructive"
          onClick={() => setIsDialogOpen(true)}
        >
          {MFA_RESET_BUTTON_LABEL}
        </Button>
      </CardContent>

      <PasswordConfirmDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={MFA_RESET_DIALOG_TITLE}
        description={MFA_RESET_DIALOG_DESCRIPTION}
        confirmLabel={MFA_RESET_DIALOG_CONFIRM_LABEL}
        submittingLabel={MFA_RESET_DIALOG_SUBMITTING_LABEL}
        onConfirm={handleConfirm}
      />
    </Card>
  );
};
