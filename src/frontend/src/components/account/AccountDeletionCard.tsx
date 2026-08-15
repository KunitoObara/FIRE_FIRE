"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountDeleteConfirmDialog } from "@/components/account/AccountDeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACCOUNT_DELETION_BUTTON_LABEL,
  ACCOUNT_DELETION_DESCRIPTION,
  ACCOUNT_DELETION_MESSAGES,
  ACCOUNT_DELETION_PASSWORD_REQUIRED_NOTICE,
  ACCOUNT_DELETION_TITLE,
} from "@/constants/account";
import { TOP_PATH } from "@/constants/routes";
import { deleteAccount } from "@/lib/auth/account-deletion";
import { clearLoggedOutNotice } from "@/lib/auth/logout-notice";
import { performSignOut } from "@/lib/auth/sign-out";

import type { JSX } from "react";

/**
 * B10のアカウント削除(docs/auth-login-requirements.md 3.11)。
 *
 * 削除に成功したらA0(公開トップ)へ置き換えて遷移し、「削除しました」をそこで1回だけ出す
 * (PO判断。削除した人はもう利用者ではないため、ログインを促すA4より公開トップが自然)。
 * 履歴を置き換えるのは、戻ってもセッションが無く、ガードがログイン画面へ送るだけのため。
 *
 * **遷移の前に明示的にサインアウトする。** 削除が済んでもクライアントSDKはユーザーを保持した
 * ままで、IDトークンの更新が失敗するまでの間`AppAccessGuard`は`ready`と判定し続ける。
 * 更新が先に失敗すると、ガードがA4へ送ってA0に着かず、完了メッセージのフラグだけが残って
 * 次にA0を開いたときに出てしまう。**サインアウトの成否は問わない** — アカウントは既に
 * 消えており、失敗しても遷移だけは行う。
 *
 * ついでに取得キャッシュも捨てる(`performSignOut`の引数)。削除した人の資産データを
 * メモリに残さないため。ログアウトの通知フラグだけは消す — 削除はログアウトではなく、
 * A4で「ログアウトしました」を出す筋合いが無い。
 *
 * **パスワードでのログインが無いアカウント(Googleのみ)ではボタンを無効化する。** 本人確認を
 * パスワードで行う以上この画面からは削除できず(3.3の他の操作と同じ制約)、押せてしまうと
 * ダイアログに入力しきってから断られることになる。理由と代わりの手段も併記する。
 */
export const AccountDeletionCard = ({
  email,
  canDelete,
}: AccountDeletionCardProps): JSX.Element => {
  const router = useRouter();
  // このカードは(dashboard)シェルの内側にあるため`QueryClientProvider`配下にある
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleConfirm = async ({
    password,
    confirmEmail,
  }: AccountDeletionFormValues): Promise<string | null> => {
    const result = await deleteAccount(password, confirmEmail);

    if (!result.ok) {
      return ACCOUNT_DELETION_MESSAGES[result.reason];
    }

    await performSignOut(() => queryClient.clear());
    clearLoggedOutNotice();

    router.replace(TOP_PATH);

    return null;
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>{ACCOUNT_DELETION_TITLE}</CardTitle>
        <CardDescription>{ACCOUNT_DELETION_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-start gap-3">
        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => setIsDialogOpen(true)}
        >
          {ACCOUNT_DELETION_BUTTON_LABEL}
        </Button>

        {canDelete ? null : (
          <p className="text-sm text-muted-foreground">
            {ACCOUNT_DELETION_PASSWORD_REQUIRED_NOTICE}
          </p>
        )}
      </CardContent>

      <AccountDeleteConfirmDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        email={email}
        onConfirm={handleConfirm}
      />
    </Card>
  );
};
