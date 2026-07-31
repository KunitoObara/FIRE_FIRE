"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PasswordField } from "@/components/auth/PasswordField";
import { PasswordPolicyChecklist } from "@/components/auth/PasswordPolicyChecklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldGroup } from "@/components/ui/field";
import {
  PASSWORD_POLICY_VIOLATION_MESSAGE,
  PASSWORD_RESET_COMPLETE_REDIRECT_MS,
  PASSWORD_RESET_COMPLETED_MESSAGE,
  PASSWORD_RESET_CONFIRM_MESSAGES,
  PASSWORD_RESET_LINK_ERROR_MESSAGES,
  PASSWORD_RESET_LINK_ERROR_TITLES,
} from "@/constants/auth";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/constants/routes";
import { completePasswordReset, verifyPasswordResetLink } from "@/lib/auth/password-reset";
import { resetPasswordSchema } from "@/schemas/reset-password";

import type { JSX } from "react";

/**
 * リンクの検証に失敗したとき、同じリンクで試し直す意味があるか。
 *
 * リンク自体が使えない(無効・期限切れ・アカウント無効化)場合はA6から取り直すほかないが、
 * 通信エラーやレート制限では`oobCode`はまだ有効な可能性がある。確定時の失敗が
 * その場で再試行できる(フォーム全体のエラー表示に留める)のと扱いを揃える。
 * 設定不足は`.env.local`を直してからの読み込み直しが要るため、ここには含めない。
 */
const canRetryVerification = (reason: PasswordResetCodeFailureReason): boolean =>
  reason === "network-error" || reason === "too-many-requests" || reason === "unknown";

/**
 * A7 パスワード再設定画面(docs/screen-requirements-auth.md A7)。
 *
 * リセットメールのリンクから`oobCode`付きで到達する。入力欄を出す前にリンクを検証し、
 * 期限切れ・使用済みのリンクでパスワードを入力させてから失敗させることのないようにする。
 *
 * 再設定に成功してもサインイン状態にはならないため、完了メッセージを出したうえでA4へ送る。
 */
export const ResetPasswordForm = ({ oobCode }: ResetPasswordFormProps): JSX.Element => {
  const router = useRouter();
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する
    mode: "onTouched",
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  // リンクの一部が欠けている場合は問い合わせるまでもなく無効。初期値の時点で確定させる
  const [state, setState] = useState<ResetPasswordState>(
    oobCode === null
      ? { status: "link-error", reason: "invalid-action-code" }
      : { status: "verifying" },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 「再試行する」で検証をやり直すための世代番号。値が変わると検証のeffectが再実行される
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  // `watch()`はReact Compilerがメモ化できないため、購読には`useWatch`を使う
  const password = useWatch({ control, name: "password" });

  // 初期表示: リンクが使えるかを先に確かめる
  useEffect(() => {
    if (oobCode === null) {
      return undefined;
    }

    let cancelled = false;

    const verify = async (): Promise<void> => {
      const result = await verifyPasswordResetLink(oobCode);
      if (cancelled) {
        return;
      }

      setState(
        result.ok
          ? { status: "ready", email: result.email }
          : { status: "link-error", reason: result.reason },
      );
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [oobCode, verifyAttempt]);

  // 完了メッセージを読み取れるだけ表示してからA4へ。戻る操作で完了表示に戻らないようreplaceする
  useEffect(() => {
    if (state.status !== "completed") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      router.replace(LOGIN_PATH);
    }, PASSWORD_RESET_COMPLETE_REDIRECT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [router, state.status]);

  const handleRetryVerification = (): void => {
    setState({ status: "verifying" });
    setVerifyAttempt((attempt) => attempt + 1);
  };

  const applyFailure = (reason: PasswordResetConfirmFailureReason): void => {
    switch (reason) {
      // 入力値の問題。リンクは有効なままなので、入力し直せば再設定できる
      case "password-policy-violation":
        setError("password", { message: PASSWORD_POLICY_VIOLATION_MESSAGE });
        break;
      // 検証を通ったあとに失効した場合。この画面では解決できないためA6への導線に切り替える
      case "invalid-action-code":
      case "user-disabled":
        setState({ status: "link-error", reason });
        break;
      default:
        setError("root", { message: PASSWORD_RESET_CONFIRM_MESSAGES[reason] });
        break;
    }
  };

  const handleValidSubmit = async (values: ResetPasswordFormValues): Promise<void> => {
    // 入力欄はリンクが有効なときしか出さないので、通常この条件は満たされる
    if (oobCode === null || state.status !== "ready") {
      return;
    }

    clearErrors("root");
    setIsSubmitting(true);

    const result = await completePasswordReset(oobCode, values.password);
    setIsSubmitting(false);

    if (!result.ok) {
      applyFailure(result.reason);
      return;
    }

    setState({ status: "completed" });
  };

  if (state.status === "verifying") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">リンクを確認しています...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "link-error") {
    return (
      <Card>
        <CardHeader className="text-center">
          <span
            aria-hidden
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10"
          >
            <TriangleAlertIcon className="size-6 text-destructive" />
          </span>
          <CardTitle className="text-xl">
            <h1>{PASSWORD_RESET_LINK_ERROR_TITLES[state.reason]}</h1>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {PASSWORD_RESET_LINK_ERROR_MESSAGES[state.reason]}
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* 一時的な失敗のときだけ、同じリンクでのやり直しを一次導線として出す */}
          {canRetryVerification(state.reason) ? (
            <Button type="button" className="w-full" onClick={handleRetryVerification}>
              再試行する
            </Button>
          ) : null}

          <Button
            asChild
            variant={canRetryVerification(state.reason) ? "outline" : "default"}
            className="w-full"
          >
            <Link href={FORGOT_PASSWORD_PATH}>パスワードをお忘れの方へ戻る</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "completed") {
    return (
      <Card>
        <CardHeader className="text-center">
          <span
            aria-hidden
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10"
          >
            <CircleCheckIcon className="size-6 text-primary" />
          </span>
          <CardTitle className="text-xl">
            <h1>パスワードを再設定しました</h1>
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center">
          <p role="status" className="rounded-lg bg-muted p-4 text-left text-sm">
            {PASSWORD_RESET_COMPLETED_MESSAGE}
          </p>

          <p className="mt-6 text-sm text-muted-foreground">
            まもなくログイン画面へ移動します。移動しない場合は{" "}
            <Link href={LOGIN_PATH} className="underline underline-offset-4">
              今すぐログイン画面へ
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>新しいパスワードを設定</h1>
        </CardTitle>
        {/* どのアカウントのパスワードを変えようとしているかを、入力前に確かめられるようにする */}
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold break-all">{state.email}</span>{" "}
          のパスワードを再設定します。
        </p>
      </CardHeader>

      <CardContent>
        <form noValidate onSubmit={handleSubmit(handleValidSubmit)}>
          <FieldGroup>
            <PasswordField
              id="password"
              label="新パスワード"
              registration={register("password")}
              error={errors.password}
            >
              <PasswordPolicyChecklist password={password} />
            </PasswordField>

            <PasswordField
              id="passwordConfirmation"
              label="新パスワード(確認用)"
              registration={register("passwordConfirmation")}
              error={errors.passwordConfirmation}
            />

            <FieldError errors={[errors.root]} />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "再設定中..." : "パスワードを再設定する"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};
