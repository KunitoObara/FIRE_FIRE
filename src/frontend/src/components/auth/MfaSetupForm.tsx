"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { CheckIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { RecoveryCodeList } from "@/components/auth/RecoveryCodeList";
import { TotpQrCode } from "@/components/auth/TotpQrCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  MFA_RECOVERY_ISSUE_FAILURE_NOTICE,
  MFA_RECOVERY_ISSUE_MESSAGES,
  TOTP_CODE_LENGTH,
  TOTP_CODE_SLOT_INDEXES,
  TOTP_ENROLLMENT_MESSAGES,
  TOTP_ENROLLMENT_START_MESSAGES,
  TOTP_START_FAILURE_REDIRECTS,
  TOTP_START_FAILURE_REDIRECT_NOTICES,
} from "@/constants/auth";
import { DASHBOARD_PATH, LOGIN_PATH, SIGNUP_PATH } from "@/constants/routes";
import {
  completeTotpEnrollment,
  formatTotpSecretKey,
  startTotpEnrollment,
} from "@/lib/auth/mfa-enrollment";
import { issueRecoveryCodes } from "@/lib/auth/mfa-recovery";
import { downloadRecoveryCodes } from "@/lib/auth/recovery-code-file";

import type { FormEvent, JSX } from "react";

const isRedirectedStartFailure = (
  reason: TotpEnrollmentStartFailureReason,
): reason is TotpEnrollmentStartRedirectFailureReason => reason in TOTP_START_FAILURE_REDIRECTS;

/**
 * A3 2FA登録画面(docs/screen-requirements-auth.md A3)。
 *
 * TOTP認証アプリと連携して2FAを有効化する、サインアップ完了の必須ステップ
 * (docs/auth-login-requirements.md 3.3 のとおり全ユーザー必須)。
 *
 * 確認コードの検証に成功したら、続けて認証アプリ紛失時のためのリカバリーコードを発行して表示する。
 * 平文のコードが手に入るのはこの表示だけなので、ユーザーが保存してから「開始する」でB1へ進む。
 * 発行に失敗しても2FA自体は有効になっているため、B1へ進む導線は残す(再発行はB10)。
 */
export const MfaSetupForm = (): JSX.Element => {
  const router = useRouter();

  const [state, setState] = useState<MfaSetupState>({ status: "loading" });
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollFailure, setEnrollFailure] = useState<TotpEnrollmentDisplayFailureReason | null>(
    null,
  );

  // 再取得は前回の生成が終わる前にも押せる。遅れて解決した古い応答が新しい結果を
  // 上書きしないよう、最後に開始した生成だけを採用する
  const latestStartIdRef = useRef(0);

  const start = useCallback(async (): Promise<void> => {
    latestStartIdRef.current += 1;
    const startId = latestStartIdRef.current;

    const result = await startTotpEnrollment();
    if (startId !== latestStartIdRef.current) {
      return;
    }

    setCode("");
    setEnrollFailure(null);
    setState(
      result.ok
        ? { status: "ready", secret: result.secret, qrCodeUrl: result.qrCodeUrl }
        : { status: "start-failed", reason: result.reason },
    );
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  /**
   * リカバリーコードを発行して表示に載せる。
   *
   * 2FAの登録が済んだ直後にだけ呼ぶ。発行できなかった場合も登録自体は有効なので、
   * この画面で行き止まりにせず、再試行とB1への導線を出す状態へ移す。
   */
  const issueCodes = useCallback(async (): Promise<void> => {
    const result = await issueRecoveryCodes();

    if (result.ok) {
      setState({ status: "enrolled", codes: result.codes });
      return;
    }

    // 発行にはサインイン中のセッションが要る。失われている場合はログインし直すほかない
    if (result.reason === "signed-out") {
      router.replace(LOGIN_PATH);
      return;
    }

    setState({ status: "recovery-codes-failed", reason: result.reason });
  }, [router]);

  /** 発行に失敗したリカバリーコードを取り直す */
  const handleRecoveryCodeRetry = (): void => {
    setState({ status: "issuing-recovery-codes" });
    void issueCodes();
  };

  /** QRコードを取り直す。取得し直している間は読み込み中の表示に戻す */
  const handleRetry = (): void => {
    setState({ status: "loading" });
    setCode("");
    setEnrollFailure(null);
    void start();
  };

  // 前提を満たさない状態は他の画面で解決する。いずれも戻る操作で復帰できないためreplaceする
  useEffect(() => {
    if (state.status === "start-failed" && isRedirectedStartFailure(state.reason)) {
      router.replace(TOTP_START_FAILURE_REDIRECTS[state.reason]);
    }
  }, [router, state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (state.status !== "ready" || code.length !== TOTP_CODE_LENGTH || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setEnrollFailure(null);

    const result = await completeTotpEnrollment(state.secret, code);

    // 既に登録済みだった場合も目的は達成されているため、完了として扱う
    if (result.ok || result.reason === "already-enrolled") {
      // 表示が入れ替わるまで再送信できないよう、`isSubmitting`は下ろさない
      setState({ status: "issuing-recovery-codes" });
      await issueCodes();
      return;
    }

    setIsSubmitting(false);

    if (result.reason === "signed-out") {
      router.replace(SIGNUP_PATH);
      return;
    }

    setEnrollFailure(result.reason);
    // 認証アプリのコードは30秒程度で切り替わる。誤りのまま残すと古いコードを再送しやすい
    setCode("");
  };

  if (state.status === "loading") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">2段階認証の設定を準備しています...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "start-failed") {
    // 他画面で解決する状態。遷移が反映されるまでの一瞬だけ表示される
    if (isRedirectedStartFailure(state.reason)) {
      return (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p role="status">{TOTP_START_FAILURE_REDIRECT_NOTICES[state.reason]}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-xl">
            <h1>2段階認証(2FA)を設定</h1>
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center">
          <p role="alert" className="text-sm text-destructive">
            {TOTP_ENROLLMENT_START_MESSAGES[state.reason]}
          </p>

          {state.reason === "requires-recent-login" ? (
            <Button asChild variant="outline" className="mt-6 w-full">
              <Link href={LOGIN_PATH}>ログイン画面へ</Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleRetry}>
              QRコードを再取得する
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (state.status === "issuing-recovery-codes") {
    return (
      <Card>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p role="status">リカバリーコードを発行しています...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "enrolled") {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span
            aria-hidden
            className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
          >
            <CheckIcon className="size-7 text-primary" />
          </span>
          <CardTitle className="text-xl">
            <h1>2段階認証の設定が完了しました</h1>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            認証アプリを紛失した場合に備えて、以下のリカバリーコードを安全な場所に保管してください。
            各コードは一度だけ使用でき、この画面を離れると再表示できません。
          </p>

          <div className="mt-6">
            <RecoveryCodeList codes={state.codes} />
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={() => downloadRecoveryCodes(state.codes, new Date())}
          >
            リカバリーコードをダウンロード
          </Button>

          <Button asChild className="mt-3 w-full">
            <Link href={DASHBOARD_PATH}>保存しました。開始する</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "recovery-codes-failed") {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span
            aria-hidden
            className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
          >
            <CheckIcon className="size-7 text-primary" />
          </span>
          <CardTitle className="text-xl">
            <h1>2段階認証の設定が完了しました</h1>
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center">
          <p role="alert" className="text-sm text-destructive">
            {MFA_RECOVERY_ISSUE_MESSAGES[state.reason]}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{MFA_RECOVERY_ISSUE_FAILURE_NOTICE}</p>

          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={handleRecoveryCodeRetry}
          >
            リカバリーコードを再発行する
          </Button>

          <Button asChild className="mt-3 w-full">
            <Link href={DASHBOARD_PATH}>開始する</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const errorMessage = enrollFailure === null ? null : TOTP_ENROLLMENT_MESSAGES[enrollFailure];

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span
          aria-hidden
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10"
        >
          <ShieldCheckIcon className="size-7 text-primary" />
        </span>
        <CardTitle className="text-xl">
          <h1>2段階認証(2FA)を設定</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          本アプリは個人の資産情報を扱うため、2FAの設定が必須です。認証アプリ(Google
          Authenticator等)でQRコードを読み取ってください。
        </p>

        <div className="mt-6 flex justify-center">
          <TotpQrCode url={state.qrCodeUrl} />
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            QRコードが読み取れない場合は、以下のキーを手動入力してください
          </p>
          <code className="mt-1 inline-block rounded bg-muted px-2 py-1 text-sm font-semibold tracking-wider break-all">
            {formatTotpSecretKey(state.secret.secretKey)}
          </code>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center">
          <Label htmlFor="totp-code">認証アプリの確認コード({TOTP_CODE_LENGTH}桁)</Label>

          <InputOTP
            id="totp-code"
            maxLength={TOTP_CODE_LENGTH}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            disabled={isSubmitting}
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
            disabled={isSubmitting || code.length !== TOTP_CODE_LENGTH}
          >
            {isSubmitting ? "確認中..." : "確認する"}
          </Button>

          {/*
            復旧導線の出し分け。
            - 確認コードの誤り: QRコードは有効なままなので何も出さず、入力し直してもらう
            - 再認証が必要: QRコードを取り直しても同じ結果になるため、ログイン画面へ送る
            - それ以外: QRコードを取り直せば解消しうる(登録セッションの期限切れが代表例。
              専用のエラーコードを特定できていないため、理由を絞らずこちらに寄せる)
          */}
          {enrollFailure === "requires-recent-login" ? (
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href={LOGIN_PATH}>ログイン画面へ</Link>
            </Button>
          ) : null}

          {enrollFailure !== null &&
          enrollFailure !== "invalid-verification-code" &&
          enrollFailure !== "requires-recent-login" ? (
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={handleRetry}>
              QRコードを再取得する
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
