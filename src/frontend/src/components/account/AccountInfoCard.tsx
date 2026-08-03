import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACCOUNT_EMAIL_LABEL,
  ACCOUNT_EMAIL_UNKNOWN_LABEL,
  ACCOUNT_INFO_TITLE,
  ACCOUNT_MFA_ENROLLED_LABEL,
  ACCOUNT_MFA_LABEL,
  ACCOUNT_MFA_NOT_ENROLLED_LABEL,
} from "@/constants/account";

import type { JSX } from "react";

/**
 * B10のアカウント情報(登録メールアドレス・2FA設定状況)。
 *
 * どちらも表示専用で、変更はそれぞれ下の「パスワード」「2段階認証」セクションから行う
 * (docs/screen-requirements-account.md B10の表示項目)。
 */
export const AccountInfoCard = ({ email, isMfaEnrolled }: AccountInfoCardProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle>{ACCOUNT_INFO_TITLE}</CardTitle>
    </CardHeader>

    <CardContent>
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-y-4 text-sm">
        <dt className="text-muted-foreground">{ACCOUNT_EMAIL_LABEL}</dt>
        <dd className="break-all">{email ?? ACCOUNT_EMAIL_UNKNOWN_LABEL}</dd>

        <dt className="text-muted-foreground">{ACCOUNT_MFA_LABEL}</dt>
        <dd>
          <Badge variant={isMfaEnrolled ? "default" : "destructive"}>
            {isMfaEnrolled ? ACCOUNT_MFA_ENROLLED_LABEL : ACCOUNT_MFA_NOT_ENROLLED_LABEL}
          </Badge>
        </dd>
      </dl>
    </CardContent>
  </Card>
);
