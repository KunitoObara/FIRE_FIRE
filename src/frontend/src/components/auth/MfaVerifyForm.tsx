"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  MFA_VERIFICATION_MESSAGES,
  MFA_VERIFY_NO_SESSION_NOTICE,
  TOTP_CODE_LENGTH,
  TOTP_CODE_SLOT_INDEXES,
} from "@/constants/auth";
import { DASHBOARD_PATH, LOGIN_PATH } from "@/constants/routes";
import { verifyTotpForSignIn } from "@/lib/auth/mfa-verification";
import { clearPendingLogin, getPendingLogin } from "@/lib/auth/pending-login";

import type { FormEvent, JSX } from "react";

/**
 * A5 2FA検証画面(docs/screen-requirements-auth.md A5)。
 *
 * A4の一次認証を通過したログインを、認証アプリの確認コードで完了させる。
 * 検証セッション(resolver)はメモリ上でのみ受け渡されるため、リロードや直接アクセスでは
 * 必ず空になる。その場合はA4からやり直してもらう。
 *
 * リカバリーコードによる検証は扱わない。Identity Platformにバックアップコードの機能が無く
 * 自前実装が必要なため、A3の発行と合わせてTrelloカード [A3-2] 2FAリカバリーコードで実装する
 * (docs/screen-requirements-auth.md A5の注記)。HTMLモックにある「リカバリーコードを使う」
 * 導線もそのカードで追加する。
 */
export const MfaVerifyForm = (): JSX.Element => {
  const router = useRouter();

  // 読み出しは非破壊なので、Strict Modeで初期化関数が二重に呼ばれても結果は変わらない。
  // 一度だけ読んで保持するのは、検証成功時にA4が預けた分を破棄しても表示を保つため
  const [pendingLogin] = useState(getPendingLogin);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<MfaVerificationFailureReason | null>(null);

  // 検証セッションが無ければA5では何もできない。戻る操作で復帰できないためreplaceする
  useEffect(() => {
    if (pendingLogin === null) {
      router.replace(LOGIN_PATH);
    }
  }, [pendingLogin, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (pendingLogin === null || code.length !== TOTP_CODE_LENGTH || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFailure(null);

    const result = await verifyTotpForSignIn(pendingLogin, code);

    if (result.ok) {
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

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <p className="text-sm font-semibold text-muted-foreground">FIRE-FIRE</p>
        <CardTitle className="text-xl">
          <h1>2段階認証</h1>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          {pendingLogin.email} として一次認証済みです
        </p>

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
            {isSubmitting ? "検証中..." : "検証する"}
          </Button>

          {/*
            検証セッションの期限切れはA5で入力し直しても解消しない。
            他の失敗は確認コードの入れ直しで解消しうるため、この画面に留める
          */}
          {failure === "session-expired" ? (
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link href={LOGIN_PATH}>ログイン画面へ</Link>
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
