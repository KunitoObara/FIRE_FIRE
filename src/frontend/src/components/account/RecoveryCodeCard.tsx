"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PasswordConfirmDialog } from "@/components/account/PasswordConfirmDialog";
import { RecoveryCodeList } from "@/components/auth/RecoveryCodeList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACCOUNT_SIGNED_OUT_MESSAGE,
  MFA_RECOVERY_STATUS_MESSAGES,
  MFA_RECOVERY_STATUS_QUERY_KEY,
  RECOVERY_CODE_DESCRIPTION,
  RECOVERY_CODE_DIALOG_TEXTS,
  RECOVERY_CODE_DOWNLOAD_LABEL,
  RECOVERY_CODE_ISSUED_CLOSE_LABEL,
  RECOVERY_CODE_ISSUED_NOTICE,
  RECOVERY_CODE_ISSUE_LABEL,
  RECOVERY_CODE_NOT_ISSUED_LABEL,
  RECOVERY_CODE_REISSUE_LABEL,
  RECOVERY_CODE_TITLE,
  buildRecoveryCodeGeneratedAtLabel,
  buildRecoveryCodeRemainingLabel,
} from "@/constants/account";
import { MFA_RECOVERY_ISSUE_MESSAGES } from "@/constants/auth";
import { issueRecoveryCodes, fetchRecoveryCodeStatus } from "@/lib/auth/mfa-recovery";
import { downloadRecoveryCodes } from "@/lib/auth/recovery-code-file";
import { formatDateTime } from "@/lib/format/date-time";

import type { JSX } from "react";

/** 残り本数と発行日時(RecoveryCodeCard内専用) */
const RecoveryCodeStatusText = ({ status }: RecoveryCodeStatusTextProps): JSX.Element => {
  if (status.generatedAt === null) {
    return <p className="text-sm text-muted-foreground">{RECOVERY_CODE_NOT_ISSUED_LABEL}</p>;
  }

  const generatedAt = formatDateTime(status.generatedAt);

  return (
    <p className="text-sm">
      <span className="font-medium">{buildRecoveryCodeRemainingLabel(status)}</span>
      {generatedAt === null ? null : (
        <span className="ml-3 text-muted-foreground">
          {buildRecoveryCodeGeneratedAtLabel(generatedAt)}
        </span>
      )}
    </p>
  );
};

/**
 * B10のリカバリーコード(docs/screen-requirements-account.md「リカバリーコードの再発行」)。
 *
 * 残り本数はFirestoreを直接読まずcallableから取る(`firestore.rules`でクライアントからの
 * 参照を全面的に拒否しているため)。再発行は以前のコードをすべて無効にするので、
 * セッションの乗っ取りで復旧手段だけを失わせられないよう本人確認を挟む。
 *
 * 発行した平文はこの応答にしか存在しないため、画面遷移せずその場に一覧を出し、
 * A3と同じくダウンロードも用意する。
 */
export const RecoveryCodeCard = (): JSX.Element => {
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null);

  const statusQuery = useQuery({
    queryKey: MFA_RECOVERY_STATUS_QUERY_KEY,
    queryFn: fetchRecoveryCodeStatus,
  });

  const statusResult = statusQuery.data;
  // 状況を取得できないうちは「発行済みかどうか」が分からない。無効になるコードがある前提の
  // 文言を出す方が実害が小さいため、再発行として扱う
  const hasIssuedCodes = statusResult?.ok !== true || statusResult.status.totalCodes > 0;
  const dialogTexts = hasIssuedCodes
    ? RECOVERY_CODE_DIALOG_TEXTS.reissue
    : RECOVERY_CODE_DIALOG_TEXTS.issue;

  const handleConfirm = async (password: string): Promise<string | null> => {
    const result = await issueRecoveryCodes(password);

    if (!result.ok) {
      return result.reason === "signed-out"
        ? ACCOUNT_SIGNED_OUT_MESSAGE
        : MFA_RECOVERY_ISSUE_MESSAGES[result.reason];
    }

    setIssuedCodes(result.codes);
    // 残り本数は発行し直しで8本に戻る。表示を実際の状態に合わせるため取り直す
    void queryClient.invalidateQueries({ queryKey: MFA_RECOVERY_STATUS_QUERY_KEY });

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{RECOVERY_CODE_TITLE}</CardTitle>
        <CardDescription>{RECOVERY_CODE_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-start gap-4">
        {statusQuery.isPending || statusResult === undefined ? (
          <Skeleton className="h-5 w-40" />
        ) : null}

        {statusResult?.ok === false ? (
          <p role="alert" className="text-sm text-destructive">
            {MFA_RECOVERY_STATUS_MESSAGES[statusResult.reason]}
          </p>
        ) : null}

        {statusResult?.ok === true ? <RecoveryCodeStatusText status={statusResult.status} /> : null}

        {issuedCodes === null ? (
          <Button type="button" variant="outline" onClick={() => setIsDialogOpen(true)}>
            {hasIssuedCodes ? RECOVERY_CODE_REISSUE_LABEL : RECOVERY_CODE_ISSUE_LABEL}
          </Button>
        ) : (
          <div className="w-full">
            <p role="status" className="text-sm text-muted-foreground">
              {RECOVERY_CODE_ISSUED_NOTICE}
            </p>

            <div className="mt-4">
              <RecoveryCodeList codes={issuedCodes} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadRecoveryCodes(issuedCodes, new Date())}
              >
                {RECOVERY_CODE_DOWNLOAD_LABEL}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIssuedCodes(null)}>
                {RECOVERY_CODE_ISSUED_CLOSE_LABEL}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <PasswordConfirmDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={dialogTexts.title}
        description={dialogTexts.description}
        confirmLabel={dialogTexts.confirmLabel}
        submittingLabel={dialogTexts.submittingLabel}
        onConfirm={handleConfirm}
      />
    </Card>
  );
};
