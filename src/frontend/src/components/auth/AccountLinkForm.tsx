"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldGroup } from "@/components/ui/field";
import {
  ACCOUNT_LINK_NO_SESSION_NOTICE,
  ACCOUNT_LINK_NOTICE,
  ACCOUNT_LINK_SIGN_IN_MESSAGES,
  SIGN_IN_NEXT_PATHS,
} from "@/constants/auth";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/constants/routes";
import { linkPendingGoogleAccount, resolveNextStepAfterLink } from "@/lib/auth/google-sign-in";
import { clearPendingGoogleLink, getPendingGoogleLink } from "@/lib/auth/pending-google-link";
import { signInWithEmail } from "@/lib/auth/sign-in";
import { accountLinkSchema } from "@/schemas/account-link";

import type { JSX } from "react";

/**
 * A8 アカウント連携画面(docs/screen-requirements-auth.md A8)。
 *
 * 既存のパスワードアカウントと同じメールアドレスでGoogleログインが行われたときにだけ到達する。
 * パスワードで本人確認したうえで、GoogleアカウントをそのFIRE-FIREアカウントへ連携する。
 *
 * 連携待ちのGoogle資格情報はメモリ上でのみ受け渡すため、リロードや直接アクセスでは必ず空になる。
 * その場合はGoogleログインからやり直してもらう(A5の検証セッションと同じ扱い)。
 *
 * 連携を実行するタイミングは2つある。
 * - 2FA登録済み — パスワード検証だけではサインインが成立しないため、A5の検証成功後に実行する
 *   (`MfaVerifyForm`が`linkPendingGoogleAccount`を呼ぶ)
 * - 2FA未登録 — パスワード検証の時点でサインインが成立するため、その場で実行してからA3/A2へ進む。
 *   このときA3とA2のどちらへ進むかは、連携の実行後に`emailVerified`を取り直してから決める
 *   (連携によって確認済みに変わりうるため)
 *
 * 連携の失敗はログインを取り消す理由にならないため、A8へは戻さずそのまま先へ進み、
 * B1のトーストで通知する(docs/screen-requirements-dashboard.md B1)。
 */
export const AccountLinkForm = (): JSX.Element => {
  const router = useRouter();

  // 読み出しは非破壊なので、Strict Modeで初期化関数が二重に呼ばれても結果は変わらない
  const [pendingLink] = useState(getPendingGoogleLink);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<AccountLinkFormValues>({
    resolver: zodResolver(accountLinkSchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  });

  // 連携待ちが無ければA8では何もできない。戻る操作で復帰できないためreplaceする
  useEffect(() => {
    if (pendingLink === null) {
      router.replace(LOGIN_PATH);
    }
  }, [pendingLink, router]);

  const handleValidSubmit = async (values: AccountLinkFormValues): Promise<void> => {
    if (pendingLink === null || isSubmitting) {
      return;
    }

    clearErrors("root");
    setIsSubmitting(true);

    // メールアドレスはGoogleから取得したものを使う。A8に入力欄は無く、連携先は
    // 「同じメールアドレスの既存アカウント」に限られるため
    const result = await signInWithEmail(
      pendingLink.email,
      values.password,
      pendingLink.rememberMe,
    );

    if (!result.ok) {
      setIsSubmitting(false);
      setError("root", { message: ACCOUNT_LINK_SIGN_IN_MESSAGES[result.reason] });
      return;
    }

    // 2FA登録済み。サインインはまだ成立していないため連携は実行できない。
    // 連携待ちは残したままA5へ渡し、確認コードの検証が通ってから連携する
    if (result.next === "mfa-verify") {
      router.replace(SIGN_IN_NEXT_PATHS[result.next]);
      return;
    }

    // 2FA未登録。この時点でサインインが成立しているのでその場で連携する。
    // 失敗してもログインは取り消さず、B1で通知する
    await linkPendingGoogleAccount();

    // `result.next`は連携前の`emailVerified`で決まっている。連携で確認済みに変わりうるため、
    // 遷移先は連携後の状態から決め直す(`resolveNextStepAfterLink`)
    router.replace(SIGN_IN_NEXT_PATHS[await resolveNextStepAfterLink(result.next)]);
  };

  /** 「連携せずにログインへ戻る」。連携待ちを残すと次のログインに紛れ込むため捨てる */
  const handleCancel = (): void => {
    clearPendingGoogleLink();
  };

  if (pendingLink === null) {
    // A4へ遷移するまでの一瞬だけ表示される
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">{ACCOUNT_LINK_NO_SESSION_NOTICE}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>アカウントを連携</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="rounded-md bg-secondary px-4 py-3 text-sm">{ACCOUNT_LINK_NOTICE}</p>

        {/* Googleから取得したメールアドレスの確認表示。入力欄ではない */}
        <p className="mt-5 rounded-md bg-secondary px-4 py-3 text-sm break-all">
          {pendingLink.email}
        </p>

        <form noValidate onSubmit={handleSubmit(handleValidSubmit)} className="mt-5">
          <FieldGroup>
            <PasswordField
              id="password"
              label="パスワード"
              registration={register("password")}
              autoComplete="current-password"
              error={errors.password}
            />

            <FieldError errors={[errors.root]} />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "連携中..." : "連携してログイン"}
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <Link href={FORGOT_PASSWORD_PATH} className="underline underline-offset-4">
            パスワードをお忘れの方
          </Link>
          <Link href={LOGIN_PATH} onClick={handleCancel} className="underline underline-offset-4">
            連携せずにログインへ戻る
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
