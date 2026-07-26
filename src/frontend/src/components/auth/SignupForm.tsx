"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, CircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { PasswordField } from "@/components/auth/PasswordField";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MASK, SIGN_UP_FORM_LEVEL_MESSAGES } from "@/constants/auth";
import { PASSWORD_RULES } from "@/constants/password";
import { LOGIN_PATH, VERIFY_EMAIL_PATH } from "@/constants/routes";
import { signUpWithEmail } from "@/lib/auth/sign-up";
import { cn } from "@/lib/utils";
import { signupSchema } from "@/schemas/signup";

import type { JSX } from "react";

/**
 * A1 サインアップフォーム。
 *
 * バリデーションはreact-hook-form + zodでインラインに表示する(DESIGN.md 6章)。
 * パスワードポリシーの充足状況は入力ごとに再評価して一覧表示する
 * (docs/auth-login-requirements.md 6章「パスワードポリシーをリアルタイムでバリデーション表示」)。
 *
 * 「アカウント作成」押下ではすぐに作成せず、入力内容の確認モーダルを挟む。
 * 実際の作成はモーダルの「はい」で実行する。
 */
export const SignupForm = (): JSX.Element => {
  const router = useRouter();
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    // 初回入力中に赤字を出さず、一度フォーカスを外した項目から検証する
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      agreedToTerms: false,
    },
  });

  // バリデーションを通過した入力値。確認モーダルの表示内容と作成処理の両方で使う
  const [confirmingValues, setConfirmingValues] = useState<SignupFormValues | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // `watch()`はReact Compilerがメモ化できないため、購読には`useWatch`を使う
  const password = useWatch({ control, name: "password" });

  const applyFailure = (reason: SignUpFailureReason): void => {
    switch (reason) {
      case "email-already-in-use":
        setError("email", { message: "このメールアドレスは既に登録されています" });
        break;
      case "invalid-email":
        setError("email", { message: "メールアドレスの形式が正しくありません" });
        break;
      case "password-policy-violation":
        setError("password", { message: "パスワードがパスワードポリシーを満たしていません" });
        break;
      default:
        setError("root", { message: SIGN_UP_FORM_LEVEL_MESSAGES[reason] });
        break;
    }
  };

  /** バリデーション通過時。まだ作成はせず、確認モーダルを開く */
  const handleValidSubmit = (values: SignupFormValues): void => {
    clearErrors("root");
    setConfirmingValues(values);
  };

  /** 確認モーダルの「はい」。ここで初めてアカウントを作成する */
  const handleConfirm = async (): Promise<void> => {
    if (confirmingValues === null) {
      return;
    }

    const values = confirmingValues;
    setConfirmingValues(null);
    setIsCreating(true);

    const result = await signUpWithEmail(values.email, values.password);

    if (!result.ok) {
      setIsCreating(false);
      applyFailure(result.reason);
      return;
    }

    router.push(VERIFY_EMAIL_PATH);
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>アカウントを作成</h1>
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

            <PasswordField
              id="password"
              label="パスワード"
              registration={register("password")}
              error={errors.password}
            >
              <ul aria-label="パスワードの条件" className="flex flex-col gap-1">
                {PASSWORD_RULES.map((rule) => {
                  const satisfied = rule.satisfiedBy(password);

                  return (
                    <li
                      key={rule.id}
                      data-satisfied={satisfied}
                      className={cn(
                        "flex items-center gap-1.5 text-sm",
                        satisfied ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {satisfied ? (
                        <CheckIcon aria-hidden className="size-3.5" />
                      ) : (
                        <CircleIcon aria-hidden className="size-3.5" />
                      )}
                      {rule.label}
                      <span className="sr-only">
                        {satisfied ? "条件を満たしています" : "条件を満たしていません"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </PasswordField>

            <PasswordField
              id="passwordConfirmation"
              label="パスワード(確認用)"
              registration={register("passwordConfirmation")}
              error={errors.passwordConfirmation}
            />

            <Field>
              <Field orientation="horizontal">
                <Controller
                  control={control}
                  name="agreedToTerms"
                  render={({ field }) => (
                    <Checkbox
                      id="agreedToTerms"
                      name={field.name}
                      ref={field.ref}
                      checked={field.value}
                      aria-invalid={errors.agreedToTerms !== undefined}
                      onBlur={field.onBlur}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                {/*
                  TODO: 利用規約・プライバシーポリシーのページを用意してリンク先を差し替える。
                  docs/screen-list-and-transitions.md の画面一覧(A1〜A7 / B1〜B10)に
                  該当する画面IDがまだ無いため、静的ページとして持つか外部URLにするかを
                  決めたうえで src/constants/routes.ts に追加する。
                */}
                <FieldLabel htmlFor="agreedToTerms" className="font-normal">
                  <span>
                    <a href="#" className="underline underline-offset-4">
                      利用規約
                    </a>{" "}
                    と{" "}
                    <a href="#" className="underline underline-offset-4">
                      プライバシーポリシー
                    </a>{" "}
                    に同意します
                  </span>
                </FieldLabel>
              </Field>
              <FieldError errors={[errors.agreedToTerms]} />
            </Field>

            <FieldError errors={[errors.root]} />

            <Button type="submit" disabled={isCreating}>
              {isCreating ? "作成中..." : "アカウント作成"}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link href={LOGIN_PATH} className="underline underline-offset-4">
            ログインはこちら
          </Link>
        </p>
      </CardContent>

      <AlertDialog
        open={confirmingValues !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingValues(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>入力内容の確認</AlertDialogTitle>
          </AlertDialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">メールアドレス:</dt>
            <dd className="break-all">{confirmingValues?.email}</dd>
            <dt className="text-muted-foreground">パスワード:</dt>
            <dd>{PASSWORD_MASK}</dd>
          </dl>

          <AlertDialogDescription>以上の内容でアカウント作成します</AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogCancel>もどる</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>はい</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
