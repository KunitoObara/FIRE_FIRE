"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { Button } from "@/components/ui/button";
import { GOOGLE_SIGN_IN_MESSAGES, GOOGLE_SIGN_IN_NEXT_PATHS } from "@/constants/auth";
import { signInWithGoogle } from "@/lib/auth/google-sign-in";

import type { JSX } from "react";

/**
 * A1・A4共通のソーシャルログイン導線(docs/screen-requirements-auth.md 2章)。
 *
 * Google側ではサインアップとログインを区別できないため、どちらの画面から始めても処理は同一で
 * 遷移先だけが結果によって変わる。分岐の判断は`signInWithGoogle`が返す`next`に委ねる。
 *
 * メール/パスワードのフォームの下に区切り線を挟んで置き、主導線に見せないようアウトラインの
 * 副次ボタンにする(同2章)。
 */
export const GoogleSignInButton = ({
  rememberMe = true,
  blockedReason,
}: GoogleSignInButtonProps): JSX.Element => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<GoogleSignInDisplayFailureReason | null>(null);

  const handleClick = async (): Promise<void> => {
    if (isSubmitting || blockedReason !== undefined) {
      return;
    }

    setIsSubmitting(true);
    setFailure(null);

    const result = await signInWithGoogle(rememberMe);

    if (result.ok) {
      // 一次認証を通過した時点で元の画面に戻る意味はないため、履歴を残さず置き換える。
      // 遷移が反映されるまで再度ポップアップを開かせないよう`isSubmitting`は下ろさない
      router.replace(GOOGLE_SIGN_IN_NEXT_PATHS[result.next]);
      return;
    }

    setIsSubmitting(false);

    // ポップアップを自分で閉じたのは取りやめであって失敗ではない。
    // エラーを出さず、元の画面をそのままの状態に戻す(同2章)
    if (result.reason === "popup-closed") {
      return;
    }

    setFailure(result.reason);
  };

  return (
    <div className="mt-6">
      {/* 「または」を左右の線の中央に置く区切り */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">または</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-5 w-full"
        disabled={isSubmitting || blockedReason !== undefined}
        onClick={handleClick}
      >
        <GoogleIcon />
        {isSubmitting ? "Googleで認証中..." : "Googleで続ける"}
      </Button>

      {/*
        押せない理由(A1の規約未同意)は、ポップアップを開く前に分かるようボタンの下に出す。
        判定は上の`disabled`と同じ`!== undefined`にする。同じpropをここだけtruthyで見ると、
        空文字が渡ったときに「押せないのに理由が出ない」状態を作れてしまう
      */}
      {blockedReason !== undefined ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{blockedReason}</p>
      ) : null}

      <p role="alert" className="mt-2 min-h-5 text-center text-sm text-destructive">
        {failure ? GOOGLE_SIGN_IN_MESSAGES[failure] : null}
      </p>
    </div>
  );
};
