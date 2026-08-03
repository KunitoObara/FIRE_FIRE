"use client";

import { AccountInfoCard } from "@/components/account/AccountInfoCard";
import { AccountPasswordCard } from "@/components/account/AccountPasswordCard";
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
 * 「ログイン方法」(Google連携の確認・追加・解除)はこの画面の要件に含まれるが、
 * Trelloカード [A8-2] 連携アカウント管理(B10)の範囲のためここでは扱わない
 * (docs/screen-requirements-account.md「連携アカウントの管理」の注記)。
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
      <RecoveryCodeCard />
      <MfaResetCard />
    </div>
  );
};
