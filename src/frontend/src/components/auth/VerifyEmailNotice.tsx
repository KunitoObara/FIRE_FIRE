"use client";

import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMAIL_VERIFICATION_POLL_INTERVAL_MS,
  RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS,
  RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS,
  RESEND_VERIFICATION_EMAIL_MESSAGES,
  RESEND_VERIFICATION_EMAIL_SUCCESS_MESSAGE,
} from "@/constants/auth";
import { MFA_SETUP_PATH, SIGNUP_PATH } from "@/constants/routes";
import {
  reloadEmailVerificationState,
  resendVerificationEmail,
} from "@/lib/auth/email-verification";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/** 確認完了を待ち続ける状態かどうか。確認済み・セッション無し・設定不足では待つ意味がない */
const shouldKeepWatching = (status: EmailVerificationState["status"]): boolean =>
  status !== "verified" && status !== "signed-out" && status !== "configuration-error";

/**
 * A2 メールアドレス確認待ち画面(docs/screen-requirements-auth.md A2)。
 *
 * 確認リンクは別タブ・別デバイスで開かれるためこの画面へ通知が来ない。そのため
 * 一定間隔のポーリングとタブ復帰時の再確認で確認完了を検知し、A3へ自動で遷移する
 * (仕様上の「主な操作」を再送ボタンだけに保つため、確認完了用のボタンは置かない)。
 */
export const VerifyEmailNotice = (): JSX.Element => {
  const router = useRouter();

  const [state, setState] = useState<EmailVerificationState>({ status: "loading" });
  // 通信が一時的に失敗しても送信先を表示し続けられるよう、判明した時点で別に保持する
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [feedback, setFeedback] = useState<ResendVerificationEmailFeedback | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const isWatching = shouldKeepWatching(state.status);

  // 確認完了の検知: 初回・一定間隔・タブ復帰時にFirebaseの状態を取り直す
  useEffect(() => {
    if (!isWatching) {
      return undefined;
    }

    let cancelled = false;

    const check = async (): Promise<void> => {
      const next = await reloadEmailVerificationState();
      if (cancelled) {
        return;
      }

      setState(next);
      if (next.status === "unverified") {
        setEmail(next.email);
      }
    };

    void check();

    const intervalId = setInterval(() => {
      void check();
    }, EMAIL_VERIFICATION_POLL_INTERVAL_MS);

    const handleVisibilityChange = (): void => {
      // メールアプリや確認リンクのタブから戻ってきた直後は、次のポーリングを待たずに確認する
      if (document.visibilityState === "visible") {
        void check();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isWatching]);

  // 確認完了ならA3へ、セッションが無ければA1へ。どちらも戻る操作で復帰できる画面ではないためreplaceする
  useEffect(() => {
    if (state.status === "verified") {
      router.replace(MFA_SETUP_PATH);
    } else if (state.status === "signed-out") {
      router.replace(SIGNUP_PATH);
    }
  }, [router, state.status]);

  // 再送クールダウンの残り秒数を1秒ずつ減らす
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setCooldownSeconds((remaining) => remaining - 1);
    }, RESEND_VERIFICATION_EMAIL_COUNTDOWN_TICK_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [cooldownSeconds]);

  const handleResend = async (): Promise<void> => {
    setIsResending(true);
    setFeedback(null);

    const result = await resendVerificationEmail();
    setIsResending(false);

    if (result.ok) {
      setFeedback({ kind: "success", message: RESEND_VERIFICATION_EMAIL_SUCCESS_MESSAGE });
      setCooldownSeconds(RESEND_VERIFICATION_EMAIL_COOLDOWN_SECONDS);
      return;
    }

    if (result.reason === "no-session") {
      setState({ status: "signed-out" });
      return;
    }

    setFeedback({ kind: "error", message: RESEND_VERIFICATION_EMAIL_MESSAGES[result.reason] });
  };

  if (state.status === "loading") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">確認状況を読み込んでいます...</p>
        </CardContent>
      </Card>
    );
  }

  // 遷移が反映されるまでの一瞬だけ表示される。案内文と再送導線は出さない
  if (state.status === "verified" || state.status === "signed-out") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">
            {state.status === "verified"
              ? "メールアドレスの確認が完了しました。2段階認証の登録に進みます..."
              : "セッションが切れました。サインアップ画面に戻ります..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const resendLabel = ((): string => {
    if (isResending) {
      return "送信中...";
    }
    return cooldownSeconds > 0
      ? `確認メールを再送する(あと${cooldownSeconds}秒)`
      : "確認メールを再送する";
  })();

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
        >
          <MailIcon className="size-7 text-primary" />
        </span>
        <CardTitle className="text-xl">
          <h1>メールアドレスの確認をお願いします</h1>
        </CardTitle>
      </CardHeader>

      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">以下の宛先に確認メールを送信しました。</p>
        {email !== null ? <p className="mt-1 text-sm font-semibold break-all">{email}</p> : null}

        <p className="mt-5 rounded-lg bg-muted p-4 text-left text-sm text-muted-foreground">
          メール本文内のリンクをクリックすると確認が完了し、続けて2段階認証(2FA)の登録に進みます。
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>

        {state.status === "unknown-error" ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            確認状況を取得できませんでした。通信状況をご確認ください。
          </p>
        ) : null}
        {state.status === "configuration-error" ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {RESEND_VERIFICATION_EMAIL_MESSAGES["configuration-error"]}
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          disabled={isResending || cooldownSeconds > 0}
          onClick={handleResend}
        >
          {resendLabel}
        </Button>

        <p
          aria-live="polite"
          className={cn(
            "mt-3 min-h-5 text-sm",
            feedback?.kind === "error" ? "text-destructive" : "text-primary",
          )}
        >
          {feedback?.message}
        </p>

        <p className="mt-2 text-sm text-muted-foreground">
          メールアドレスが間違っている場合は、
          <Link href={SIGNUP_PATH} className="underline underline-offset-4">
            サインアップからやり直してください
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
