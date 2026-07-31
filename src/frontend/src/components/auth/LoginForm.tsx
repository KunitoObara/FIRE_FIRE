"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { DevDashboardShortcut } from "@/components/auth/DevDashboardShortcut";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SIGN_IN_MESSAGES, SIGN_IN_NEXT_PATHS } from "@/constants/auth";
import { FORGOT_PASSWORD_PATH, SIGNUP_PATH } from "@/constants/routes";
import { signInWithEmail } from "@/lib/auth/sign-in";
import { loginSchema } from "@/schemas/login";

import type { JSX } from "react";

/**
 * A4 ログイン画面(docs/screen-requirements-auth.md A4)。
 *
 * ここで完了するのは一次認証まで。2FAは全ユーザー必須(docs/auth-login-requirements.md 3.3)のため、
 * 通常はA5の確認コード検証へ進む。遷移先の判断は`signInWithEmail`が返す`next`に委ねる。
 *
 * 認証失敗はメールアドレス欄/パスワード欄に出し分けず、フォーム全体のエラーとして表示する
 * (どちらが誤りかを示すと未登録のメールアドレスを外部から判定できてしまうため)。
 */
export const LoginForm = (): JSX.Element => {
  const router = useRouter();
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      // 個人が自分の端末から使うアプリのため、既定で保持する
      rememberMe: true,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidSubmit = async (values: LoginFormValues): Promise<void> => {
    clearErrors("root");
    setIsSubmitting(true);

    const result = await signInWithEmail(values.email, values.password, values.rememberMe);

    if (!result.ok) {
      setIsSubmitting(false);
      setError("root", { message: SIGN_IN_MESSAGES[result.reason] });
      return;
    }

    // 一次認証を通過した時点でA4に戻る意味はないため、履歴を残さず置き換える
    router.replace(SIGN_IN_NEXT_PATHS[result.next]);
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>ログイン</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
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

            {/* ログインではパスワードポリシーの充足一覧は出さない(A1の登録時のみの表示) */}
            <PasswordField
              id="password"
              label="パスワード"
              registration={register("password")}
              autoComplete="current-password"
              error={errors.password}
            />

            {/* 横並びだと狭い画面でラベルが折り返すため、小さい画面では縦に積む */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <Field orientation="horizontal" className="w-auto">
                <Controller
                  control={control}
                  name="rememberMe"
                  render={({ field }) => (
                    <Checkbox
                      id="rememberMe"
                      name={field.name}
                      ref={field.ref}
                      checked={field.value}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <FieldLabel htmlFor="rememberMe" className="font-normal">
                  ログイン状態を保持する
                </FieldLabel>
              </Field>

              <Link
                href={FORGOT_PASSWORD_PATH}
                className="text-sm whitespace-nowrap underline underline-offset-4"
              >
                パスワードをお忘れの方
              </Link>
            </div>

            <FieldError errors={[errors.root]} />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link href={SIGNUP_PATH} className="underline underline-offset-4">
            サインアップ
          </Link>
        </p>

        <DevDashboardShortcut />
      </CardContent>
    </Card>
  );
};
