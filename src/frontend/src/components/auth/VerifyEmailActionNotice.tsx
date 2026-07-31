"use client";

import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMAIL_VERIFICATION_APPLIED_MESSAGE,
  EMAIL_VERIFICATION_APPLY_MESSAGES,
} from "@/constants/auth";
import { LOGIN_PATH } from "@/constants/routes";
import { applyEmailVerification } from "@/lib/auth/email-action";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/**
 * 確認メールのリンク(`mode=verifyEmail`)を適用する画面。
 *
 * A2の待機画面(`VerifyEmailNotice`)とは別物で、こちらはメールのリンクを開いた側のタブ。
 * リンクは別のブラウザ・別の端末で開かれうるため、この画面ではサインイン状態を前提にせず、
 * 確認の適用と結果表示だけを行う。サインアップ元のタブはポーリングで確認完了を検知し
 * A3へ自動で進む(docs/screen-requirements-auth.md A2)。
 */
export const VerifyEmailActionNotice = ({ oobCode }: VerifyEmailActionNoticeProps): JSX.Element => {
  // リンクの一部が欠けている場合は問い合わせるまでもなく無効。初期値の時点で確定させる
  const [state, setState] = useState<EmailVerificationApplyState>(
    oobCode === null ? { status: "failed", reason: "invalid-action-code" } : { status: "applying" },
  );

  /**
   * 既に適用を開始したワンタイムコード。
   *
   * 開発時のStrict Modeではeffectが「実行→破棄→再実行」されるため、ガードが無いと
   * `applyActionCode`が2回走る。1回目でコードは消費されるので2回目は必ず
   * `auth/invalid-action-code`になり、確認は成功しているのに失敗表示になってしまう。
   * `applyActionCode`は読み取りではなく一度きりの副作用のため、結果を捨てる
   * 破棄フラグでは足りず、呼び出し自体を1回に抑える必要がある。
   */
  const appliedOobCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (oobCode === null || appliedOobCodeRef.current === oobCode) {
      return;
    }
    appliedOobCodeRef.current = oobCode;

    const apply = async (): Promise<void> => {
      const result = await applyEmailVerification(oobCode);
      setState(result.ok ? { status: "applied" } : { status: "failed", reason: result.reason });
    };

    void apply();
  }, [oobCode]);

  if (state.status === "applying") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">メールアドレスを確認しています...</p>
        </CardContent>
      </Card>
    );
  }

  const applied = state.status === "applied";

  return (
    <Card>
      <CardHeader className="text-center">
        <span
          aria-hidden
          className={cn(
            "mx-auto flex size-12 items-center justify-center rounded-full",
            applied ? "bg-primary/10" : "bg-destructive/10",
          )}
        >
          {applied ? (
            <CircleCheckIcon className="size-6 text-primary" />
          ) : (
            <TriangleAlertIcon className="size-6 text-destructive" />
          )}
        </span>
        <CardTitle className="text-xl">
          <h1>{applied ? "メールアドレスを確認しました" : "確認を完了できませんでした"}</h1>
        </CardTitle>
      </CardHeader>

      <CardContent className="text-center">
        <p
          role={applied ? "status" : "alert"}
          className="rounded-lg bg-muted p-4 text-left text-sm"
        >
          {applied
            ? EMAIL_VERIFICATION_APPLIED_MESSAGE
            : EMAIL_VERIFICATION_APPLY_MESSAGES[state.reason]}
        </p>

        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href={LOGIN_PATH}>ログイン画面へ</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
