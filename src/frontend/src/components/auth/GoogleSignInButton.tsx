"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GOOGLE_SIGN_IN_MESSAGES, GOOGLE_SIGN_IN_NEXT_PATHS } from "@/constants/auth";
import { signInWithGoogle } from "@/lib/auth/google-sign-in";

import type { JSX } from "react";

/** Googleのブランドカラーの「G」マーク。Googleのブランドガイドラインに沿って色を変えない */
const GoogleIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
    <path
      fill="#4285F4"
      d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A11.997 11.997 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
    />
  </svg>
);

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

      {/* 押せない理由(A1の規約未同意)は、ポップアップを開く前に分かるようボタンの下に出す */}
      {blockedReason === undefined ? null : (
        <p className="mt-2 text-center text-sm text-muted-foreground">{blockedReason}</p>
      )}

      <p role="alert" className="mt-2 min-h-5 text-center text-sm text-destructive">
        {failure === null ? null : GOOGLE_SIGN_IN_MESSAGES[failure]}
      </p>
    </div>
  );
};
