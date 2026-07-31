import { redirect } from "next/navigation";

import { VerifyEmailActionNotice } from "@/components/auth/VerifyEmailActionNotice";
import { Card, CardContent } from "@/components/ui/card";
import { UNSUPPORTED_EMAIL_ACTION_MESSAGE } from "@/constants/auth";
import { RESET_PASSWORD_PATH } from "@/constants/routes";
import { firstQueryValue } from "@/lib/query-params";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "メールリンクの確認 | FIRE-FIRE",
};

/**
 * Firebaseが送るメール内リンクの受け口(アクションURL)。
 *
 * アクションURLはFirebaseプロジェクトに1つしか設定できず、パスワード再設定・メールアドレス確認の
 * どちらのリンクもここに来るため`mode`で振り分ける(docs/ci-cd-setup.md の設定手順を参照)。
 * `continueUrl`・`lang`も付くが、遷移先は画面ごとに決まっているため使わない。
 */
const AuthActionPage = async ({
  searchParams,
}: PageProps<"/auth/action">): Promise<JSX.Element> => {
  const params = await searchParams;
  const mode = firstQueryValue(params.mode);
  const oobCode = firstQueryValue(params.oobCode);

  // A7へは`oobCode`だけを引き継ぐ。リンク自体が壊れている場合もA7側で無効として案内する
  if (mode === "resetPassword") {
    const query = oobCode === null ? "" : `?oobCode=${encodeURIComponent(oobCode)}`;
    redirect(`${RESET_PASSWORD_PATH}${query}`);
  }

  if (mode === "verifyEmail") {
    return <VerifyEmailActionNotice oobCode={oobCode} />;
  }

  // メールアドレスの変更(`recoverEmail`)は未実装のため、ここには来ない想定
  return (
    <Card>
      <CardContent className="text-center">
        <p role="alert" className="text-sm text-muted-foreground">
          {UNSUPPORTED_EMAIL_ACTION_MESSAGE}
        </p>
      </CardContent>
    </Card>
  );
};

export default AuthActionPage;
