"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACCOUNT_PASSWORD_DESCRIPTION,
  ACCOUNT_PASSWORD_SENDING_LABEL,
  ACCOUNT_PASSWORD_SEND_LABEL,
  ACCOUNT_PASSWORD_TITLE,
  buildPasswordResetSentMessage,
} from "@/constants/account";
import { PASSWORD_RESET_MESSAGES } from "@/constants/auth";
import { requestPasswordReset } from "@/lib/auth/password-reset";

import type { JSX } from "react";

/**
 * B10のパスワード変更(docs/screen-requirements-account.md B10)。
 *
 * 現在のパスワードは入力させず、A6〜A7と同じリセットメールのフローを使う。
 * 送信するのはログイン中の登録メールアドレス宛だけなので、A6と違い宛先の入力欄は持たない。
 */
export const AccountPasswordCard = ({ email }: AccountPasswordCardProps): JSX.Element => {
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<AccountPasswordResetFeedback | null>(null);

  const handleSend = async (): Promise<void> => {
    if (email === null) {
      return;
    }

    setIsSending(true);
    setFeedback(null);

    const result = await requestPasswordReset(email);

    setIsSending(false);
    setFeedback(
      result.ok
        ? { kind: "success", message: buildPasswordResetSentMessage(email) }
        : { kind: "error", message: PASSWORD_RESET_MESSAGES[result.reason] },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ACCOUNT_PASSWORD_TITLE}</CardTitle>
        <CardDescription>{ACCOUNT_PASSWORD_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-start gap-4">
        {feedback !== null ? (
          <Alert
            variant={feedback.kind === "error" ? "error" : "success"}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </Alert>
        ) : null}

        {/* 送信先が分からない状態では押させない(宛先の入力欄を持たないため) */}
        <Button
          type="button"
          variant="outline"
          disabled={isSending || email === null}
          onClick={handleSend}
        >
          {isSending ? ACCOUNT_PASSWORD_SENDING_LABEL : ACCOUNT_PASSWORD_SEND_LABEL}
        </Button>
      </CardContent>
    </Card>
  );
};
