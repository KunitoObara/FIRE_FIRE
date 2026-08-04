"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  MFA_RECOVERY_RESIGN_IN_FAILURE_MESSAGE,
  MFA_RECOVERY_USE_MESSAGES,
  MFA_VERIFICATION_MESSAGES,
  MFA_VERIFY_NO_SESSION_NOTICE,
  SIGN_IN_NEXT_PATHS,
  TOTP_CODE_LENGTH,
  TOTP_CODE_SLOT_INDEXES,
} from "@/constants/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/constants/routes";
import { linkPendingGoogleAccount } from "@/lib/auth/google-sign-in";
import { redeemRecoveryCode } from "@/lib/auth/mfa-recovery";
import { verifyTotpForSignIn } from "@/lib/auth/mfa-verification";
import { clearPendingLogin, getPendingLogin } from "@/lib/auth/pending-login";
import { signInWithEmail } from "@/lib/auth/sign-in";

import type { FormEvent, JSX } from "react";

/**
 * A5 2FA検証画面(docs/screen-requirements-auth.md A5)。
 *
 * A4の一次認証を通過したログインを、認証アプリの確認コードで完了させる。
 * 検証セッション(resolver)はメモリ上でのみ受け渡されるため、リロードや直接アクセスでは
 * 必ず空になる。その場合はA4からやり直してもらう。
 *
 * 認証アプリを紛失した場合は「リカバリーコードを使う」に切り替える。こちらはこの画面で
 * ログインを完了させず、Cloud Functionsで2FA(TOTP)の登録を解除したうえで一次認証をやり直し、
 * 2FA未登録として扱われるA3の再登録へ進む(docs/screen-requirements-auth.md A5)。
 * Identity PlatformはTOTPの確認コード以外で二次認証を完了できないため、
 * リカバリーコードでそのままB1へ進む経路は作らない。
 */
export const MfaVerifyForm = (): JSX.Element => {
  const router = useRouter();

  // 読み出しは非破壊なので、Strict Modeで初期化関数が二重に呼ばれても結果は変わらない。
  // 一度だけ読んで保持するのは、検証成功時にA4が預けた分を破棄しても表示を保つため
  const [pendingLogin] = useState(getPendingLogin);
  const [mode, setMode] = useState<MfaVerifyMode>("totp");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<MfaVerificationFailureReason | null>(null);
  const [recoveryFailure, setRecoveryFailure] = useState<MfaRecoveryUseFailureReason | null>(null);
  // 2FAの解除には成功したが、その後のログインをやり直せなかった状態。
  // 解除自体は済んでいるため、A4からログインし直せばA3の再登録へ進める
  const [isResignInFailed, setIsResignInFailed] = useState(false);

  // 検証セッションが無ければA5では何もできない。戻る操作で復帰できないためreplaceする
  useEffect(() => {
    if (pendingLogin === null) {
      router.replace(LOGIN_PATH);
    }
  }, [pendingLogin, router]);

  // 期限切れの検証セッションは同じresolverで何度送り直しても復活しない。
  // 入力自体を止めて、A4からやり直す導線へ寄せる
  const isSessionExpired = failure === "session-expired";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (
      pendingLogin === null ||
      code.length !== TOTP_CODE_LENGTH ||
      isSubmitting ||
      isSessionExpired
    ) {
      return;
    }

    setIsSubmitting(true);
    setFailure(null);

    const result = await verifyTotpForSignIn(pendingLogin, code);

    if (result.ok) {
      // A8から来た場合のみ、この時点でサインインが成立するのでGoogleアカウントを連携する。
      // 連携待ちが無い通常のログインでは何もしない(`google-sign-in.ts`)。
      // 失敗してもログインは取り消さず、B1がトーストで通知する
      await linkPendingGoogleAccount();

      // 検証セッションは役目を終えた。以降のログインは必ずA4からやり直す
      clearPendingLogin();
      // 二次認証まで終えた時点でA5に戻る意味はないため、履歴を残さず置き換える。
      // 遷移が反映されるまで再送信できないよう、`isSubmitting`は下ろさない
      router.replace(DASHBOARD_PATH);
      return;
    }

    setIsSubmitting(false);
    setFailure(result.reason);
    // 認証アプリのコードは30秒程度で切り替わる。誤りのまま残すと古いコードを再送しやすい
    setCode("");
  };

  /**
   * リカバリーコードで2FAの登録を解除し、ログインをやり直す。
   *
   * 解除だけではサインインは成立しないため、続けて一次認証をやり直す。パスワードはA4から
   * メモリで引き継いだ値を使う(`pending-login.ts`)ので、ユーザーの再入力は要らない。
   */
  const handleRecoverySubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const password = pendingLogin?.password;

    if (pendingLogin === null || password === undefined || isSubmitting) {
      return;
    }

    if (recoveryCode.trim() === "") {
      return;
    }

    setIsSubmitting(true);
    setRecoveryFailure(null);

    const result = await redeemRecoveryCode(pendingLogin.email, password, recoveryCode);

    if (!result.ok) {
      setIsSubmitting(false);
      setRecoveryFailure(result.reason);
      // 使用済み・誤りのコードを残すと同じものを再送しやすい
      setRecoveryCode("");
      return;
    }

    // 2FAは解除済み。ここからは2FA未登録のアカウントと同じで、一次認証がそのまま通る。
    // `signInWithEmail`が検証待ちの受け渡しを破棄するため、ここでの後始末は要らない
    const signIn = await signInWithEmail(pendingLogin.email, password, pendingLogin.rememberMe);

    if (!signIn.ok) {
      setIsSubmitting(false);
      setIsResignInFailed(true);
      return;
    }

    // A8から来た場合はこのやり直しでサインインが成立するため、確認コードでの検証成功時と
    // 同じくGoogleアカウントを連携する。ここで連携しないと、預かった資格情報が使われないまま
    // 残り続ける(docs/screen-requirements-auth.md A5)
    await linkPendingGoogleAccount();

    // 解除できているので通常は`mfa-setup`(A3)に落ちる。判断は`signInWithEmail`に委ね、
    // 万一2FAが残っていた場合もその指示どおりの画面へ進める
    router.replace(SIGN_IN_NEXT_PATHS[signIn.next]);
  };

  /**
   * 確認コードとリカバリーコードの入力を切り替える。持ち越したエラーは消す。
   *
   * 検証セッションの期限切れだけは残す。切り替えても検証セッションは戻らないため、
   * ここで消すと確認コードの入力へ戻ったときに無効化が解けてしまう。
   */
  const handleModeChange = (nextMode: MfaVerifyMode): void => {
    setMode(nextMode);
    setFailure((current) => (current === "session-expired" ? current : null));
    setRecoveryFailure(null);
  };

  if (pendingLogin === null) {
    // A4へ遷移するまでの一瞬だけ表示される
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">{MFA_VERIFY_NO_SESSION_NOTICE}</p>
        </CardContent>
      </Card>
    );
  }

  const errorMessage = failure === null ? null : MFA_VERIFICATION_MESSAGES[failure];
  const recoveryErrorMessage =
    recoveryFailure === null ? null : MFA_RECOVERY_USE_MESSAGES[recoveryFailure];

  // Googleログイン経由では、Firebaseが投げるMFAのエラーにメールアドレスが載らないことがある
  // (`src/lib/auth/google-sign-in.ts`)。その場合は宛名を伏せ、一次認証が済んだことだけを伝える
  const signedInNotice =
    pendingLogin.email === ""
      ? "一次認証が完了しています"
      : `${pendingLogin.email} として一次認証済みです`;

  // リカバリーコードの検証はパスワードでの一次認証を前提にする(サーバー側で再確認するため)。
  // Googleのポップアップだけで一次認証を通った場合はパスワードを引き継げないので導線を出さない。
  // A8経由はユーザーがパスワードを入力しているため引き継げており、A4からの経路と同じく出す
  // (docs/screen-requirements-auth.md A5)
  const canUseRecoveryCode = pendingLogin.password !== undefined;

  if (isResignInFailed) {
    // 2FAは解除済み。この画面に留まっても検証セッションは既に使えないため、A4へ送る
    return (
      <Card>
        <CardContent className="text-center">
          <p role="alert" className="text-sm text-muted-foreground">
            {MFA_RECOVERY_RESIGN_IN_FAILURE_MESSAGE}
          </p>

          <Button asChild className="mt-6 w-full">
            <Link href={LOGIN_PATH}>ログイン画面へ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "recovery") {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
          <CardTitle className="text-xl">
            <h1>2段階認証</h1>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">{signedInNotice}</p>

          <form onSubmit={handleRecoverySubmit} className="mt-6">
            <Field>
              <FieldLabel htmlFor="recovery-code">リカバリーコード</FieldLabel>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={isSubmitting}
                aria-invalid={recoveryErrorMessage !== null}
                aria-describedby="recovery-code-error"
              />
              <FieldDescription>
                各リカバリーコードは一度使用すると無効になります。使用すると2段階認証の登録が解除されるため、
                続けて認証アプリの再登録が必要になります。
              </FieldDescription>
            </Field>

            <p
              id="recovery-code-error"
              role="alert"
              className="mt-3 min-h-5 text-sm text-destructive"
            >
              {recoveryErrorMessage}
            </p>

            <Button
              type="submit"
              className="mt-3 w-full"
              disabled={isSubmitting || recoveryCode.trim() === ""}
            >
              {isSubmitting ? "検証中..." : "検証する"}
            </Button>

            <Button
              type="button"
              variant="link"
              className="mt-4 w-full"
              disabled={isSubmitting}
              onClick={() => handleModeChange("totp")}
            >
              認証アプリのコードに戻る
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>2段階認証</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-center text-sm text-muted-foreground">{signedInNotice}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center">
          <Label htmlFor="totp-code">認証アプリの確認コード({TOTP_CODE_LENGTH}桁)</Label>

          {/*
            オートフォーカスは付けない。input-otpはフォーカス中にパスワードマネージャーの
            バッジ位置を測るタイマーを回すため、描画と同時にフォーカスするとjsdom上でも
            そのタイマーが走り、環境の破棄後に発火して未捕捉エラーになる。A3の入力欄と揃える
          */}
          <InputOTP
            id="totp-code"
            maxLength={TOTP_CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            disabled={isSubmitting || isSessionExpired}
            aria-invalid={errorMessage !== null}
            aria-describedby="totp-code-error"
            containerClassName="mt-2"
          >
            <InputOTPGroup>
              {TOTP_CODE_SLOT_INDEXES.map((index) => (
                <InputOTPSlot key={index} index={index} className="size-11 text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <p id="totp-code-error" role="alert" className="mt-3 min-h-5 text-sm text-destructive">
            {errorMessage}
          </p>

          <Button
            type="submit"
            className="mt-3 w-full"
            disabled={isSubmitting || isSessionExpired || code.length !== TOTP_CODE_LENGTH}
          >
            {isSubmitting ? "検証中..." : "検証する"}
          </Button>

          {/*
            検証セッションの期限切れはA5で入力し直しても解消しない。
            他の失敗は確認コードの入れ直しで解消しうるため、この画面に留める
          */}
          {isSessionExpired ? (
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href={LOGIN_PATH}>ログイン画面へ</Link>
            </Button>
          ) : null}

          {/*
            認証アプリを紛失した場合の代替手段。切替後の検証はA3で発行したコードで行う。
            こちらは検証セッション(resolver)を使わずメール・パスワードで解除するため、
            期限切れの後でも成立する。A4へ往復させずに済むよう導線は残す
          */}
          {canUseRecoveryCode ? (
            <Button
              type="button"
              variant="link"
              className="mt-4 w-full"
              disabled={isSubmitting}
              onClick={() => handleModeChange("recovery")}
            >
              リカバリーコードを使う
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
