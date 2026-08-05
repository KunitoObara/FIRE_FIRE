"use client";

import { useState } from "react";

import { LinkedProviderRow } from "@/components/account/LinkedProviderRow";
import { UnlinkProviderDialog } from "@/components/account/UnlinkProviderDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GOOGLE_LINKED_MESSAGE,
  LINKED_ACCOUNTS_DESCRIPTION,
  LINKED_ACCOUNTS_NOTIFICATION_NOTICE,
  LINKED_ACCOUNTS_TITLE,
  LINK_GOOGLE_MESSAGES,
  buildProviderUnlinkedMessage,
} from "@/constants/account";
import { getLinkedProviders, linkGoogleAccount, unlinkProvider } from "@/lib/auth/linked-providers";

import type { JSX } from "react";

/**
 * B10のログイン方法(docs/screen-requirements-account.md「連携アカウントの管理」)。
 *
 * 連携・解除とも画面遷移せず、結果はこのカード内のメッセージで伝える(同要件の制約)。
 * 一覧は`currentUser`から作り直す — 連携・解除は`providerData`を書き換えるため、
 * 実行後に取り直すだけで表示が実際の状態に追いつく。
 */
export const LinkedAccountsCard = (): JSX.Element => {
  const [providers, setProviders] = useState<LinkedProviderStatus[]>(getLinkedProviders);
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedProviderId | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [feedback, setFeedback] = useState<LinkedAccountsFeedback | null>(null);

  // 解除できるのは他にログイン方法が残る場合だけ。ここでの判定はボタンを押させないための表示上のもので、
  // 実際の歯止めは`unlinkProvider`側にある(この一覧に無いプロバイダまで数える必要があるため)
  const linkedCount = providers.filter((provider) => provider.isLinked).length;

  const handleLink = async (): Promise<void> => {
    setIsLinking(true);
    setFeedback(null);

    const result = await linkGoogleAccount();

    setIsLinking(false);

    if (!result.ok) {
      // ポップアップを自分で閉じたのは取りやめであって失敗ではない。
      // エラーを出さず元の状態に戻す(A1・A4の「Googleで続ける」と同じ扱い)
      if (result.reason === "popup-closed") {
        return;
      }

      setFeedback({ kind: "error", message: LINK_GOOGLE_MESSAGES[result.reason] });
      return;
    }

    setProviders(getLinkedProviders());
    setFeedback({ kind: "success", message: GOOGLE_LINKED_MESSAGE });
  };

  const handleUnlink = async (provider: LinkedProviderId): Promise<UnlinkProviderResult> => {
    setFeedback(null);

    const result = await unlinkProvider(provider);

    // 失敗はダイアログ内に出す。閉じた先にメッセージだけ残ると、何に失敗したのか辿れないため
    if (result.ok) {
      setProviders(getLinkedProviders());
      setFeedback({ kind: "success", message: buildProviderUnlinkedMessage(provider) });
    }

    return result;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{LINKED_ACCOUNTS_TITLE}</CardTitle>
        <CardDescription>{LINKED_ACCOUNTS_DESCRIPTION}</CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col divide-y">
          {providers.map((provider) => (
            <LinkedProviderRow
              key={provider.id}
              provider={provider}
              isLastProvider={linkedCount <= 1}
              isLinking={isLinking}
              onLink={handleLink}
              onUnlink={setUnlinkTarget}
            />
          ))}
        </ul>

        {feedback ? (
          <p
            role={feedback.kind === "error" ? "alert" : "status"}
            className={feedback.kind === "error" ? "mt-4 text-sm text-destructive" : "mt-4 text-sm"}
          >
            {feedback.message}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">{LINKED_ACCOUNTS_NOTIFICATION_NOTICE}</p>
      </CardContent>

      <UnlinkProviderDialog
        provider={unlinkTarget}
        onOpenChange={(open) => setUnlinkTarget(open ? unlinkTarget : null)}
        onConfirm={handleUnlink}
      />
    </Card>
  );
};
