import { redirect } from "next/navigation";

import { VerifyEmailActionNotice } from "@/components/auth/VerifyEmailActionNotice";
import { Card, CardContent } from "@/components/ui/card";
import { UNSUPPORTED_EMAIL_ACTION_MESSAGE } from "@/constants/auth";
import { resolveEmailActionTarget } from "@/lib/auth/email-action-mode";
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
  const target = resolveEmailActionTarget(
    firstQueryValue(params.mode),
    firstQueryValue(params.oobCode),
  );

  // A7へは`oobCode`だけを引き継ぐ。リンク自体が壊れている場合もA7側で無効として案内する
  if (target.kind === "reset-password") {
    redirect(target.path);
  }

  if (target.kind === "verify-email") {
    return <VerifyEmailActionNotice oobCode={target.oobCode} />;
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
