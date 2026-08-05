"use client";

import { AccountInfoCard } from "@/components/account/AccountInfoCard";
import { AccountPasswordCard } from "@/components/account/AccountPasswordCard";
import { LinkedAccountsCard } from "@/components/account/LinkedAccountsCard";
import { MfaResetCard } from "@/components/account/MfaResetCard";
import { RecoveryCodeCard } from "@/components/account/RecoveryCodeCard";
import { hasEnrolledTotp } from "@/lib/auth/mfa-enrollment";
import { getFirebaseAuth } from "@/lib/firebase/client";

import type { JSX } from "react";

/**
 * B10 アカウント設定画面の本体(docs/screen-requirements-account.md B10)。
 *
 * 表示項目(登録メールアドレス・2FA設定状況)はFirestoreではなくFirebase Authの
 * 現在のユーザーから引くため、Client Componentにしている。`AppAccessGuard`が
 * readyと判定した後にしか描画されないので、ここでの`currentUser`はサインイン済みを指す。
 *
 * セクションの並びはモック(src/frontend/docs/html_mock/b10-account-settings.html)に合わせ、
 * ログイン手段そのものの話(アカウント情報・パスワード・ログイン方法)を先に、
 * 2FA関連(リカバリーコード・再設定)を後に置く。
 */
export const AccountSettingsScreen = (): JSX.Element => {
  const user = getFirebaseAuth().currentUser;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <AccountInfoCard
        email={user?.email ?? null}
        isMfaEnrolled={user === null ? false : hasEnrolledTotp(user)}
      />
      <AccountPasswordCard email={user?.email ?? null} />
      <LinkedAccountsCard />
      <RecoveryCodeCard />
      <MfaResetCard />
    </div>
  );
};
