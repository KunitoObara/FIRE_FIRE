"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_RESET_MESSAGES, PASSWORD_RESET_SENT_MESSAGE } from "@/constants/auth";
import { LOGIN_PATH } from "@/constants/routes";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { forgotPasswordSchema } from "@/schemas/forgot-password";

import type { JSX } from "react";

/**
 * A6 パスワードをお忘れの方画面(docs/screen-requirements-auth.md A6)。
 *
 * 送信操作のあとは画面遷移せず、同じカード内で完了メッセージに切り替える。
 * 未登録のメールアドレスでも同一のメッセージを出し、アカウントの存在有無を推測されないようにする
 * (この出し分けの無さは`src/lib/auth/password-reset.ts`側で担保する)。
 *
 * メールが届かない原因の多くは宛先の打ち間違いのため、完了表示からも入力欄へ戻せるようにする。
 */
export const ForgotPasswordForm = (): JSX.Element => {
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleValidSubmit = async (values: ForgotPasswordFormValues): Promise<void> => {
    clearErrors("root");
    setIsSubmitting(true);

    const result = await requestPasswordReset(values.email);
    setIsSubmitting(false);

    if (!result.ok) {
      setError("root", { message: PASSWORD_RESET_MESSAGES[result.reason] });
      return;
    }

    setIsSent(true);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>パスワードをお忘れの方</h1>
        </CardTitle>
        {!isSent ? (
          <p className="text-sm text-muted-foreground">
            ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
          </p>
        ) : null}
      </CardHeader>

      <CardContent>
        {isSent ? (
          <div className="text-center">
            <span
              aria-hidden
              className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
            >
              <MailCheckIcon className="size-7 text-primary" />
            </span>

            <Alert variant="success" role="status" className="mt-5">
              {PASSWORD_RESET_SENT_MESSAGE}
            </Alert>

            {/* 入力欄は残したままなので、宛先を打ち間違えていても入力し直すだけで送り直せる */}
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full"
              onClick={() => {
                setIsSent(false);
              }}
            >
              別のメールアドレスで送り直す
            </Button>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit(handleValidSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">メールアドレス</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={errors.email !== undefined}
                  {...register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>

              <FieldError errors={[errors.root]} />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "送信中..." : "リセットメールを送信する"}
              </Button>
            </FieldGroup>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href={LOGIN_PATH} className="underline underline-offset-4">
            ログインに戻る
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
