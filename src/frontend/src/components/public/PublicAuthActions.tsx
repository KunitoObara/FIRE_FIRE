"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { INVITE_ONLY_NOTICE } from "@/constants/public";
import { DASHBOARD_PATH, LOGIN_PATH, SIGNUP_PATH } from "@/constants/routes";
import { subscribeToPublicSessionState } from "@/lib/auth/public-session";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/**
 * 判定確定前に確保しておく領域の高さ。**ボタンの実寸と一致させる。**
 *
 * `sm`は`Button size="sm"`の`h-8`、`lg`はA0のCTA用に少し大きくした`h-11`。
 * ずれていると、導線が埋まった瞬間に本文が跳ねる。
 *
 * **固定値(`h-*`)ではなく下限(`min-h-*`)にしてある。** 狭い幅で導線が折り返したときに、
 * 固定だと2行目が枠からはみ出して見切れる。下限なら確定前に確保する高さは同じまま、
 * 折り返した分は素直に伸びる。
 */
const ACTIONS_MIN_HEIGHT_CLASS: Record<PublicAuthActionsSize, string> = {
  sm: "min-h-8",
  lg: "min-h-11",
};

/** A0のCTAはヘッダーより押しやすい寸法にする */
const BUTTON_CLASS: Record<PublicAuthActionsSize, string> = {
  sm: "",
  lg: "h-11 px-6 text-[0.9375rem]",
};

/**
 * 「ログイン」側の見た目。ヘッダーは背景に溶かし、A0のCTAでは枠線を付けて
 * 「サインアップ」と並べても押せると分かるようにする(モック `a0-top.html` と同じ)。
 */
const SECONDARY_VARIANT: Record<PublicAuthActionsSize, "ghost" | "outline"> = {
  sm: "ghost",
  lg: "outline",
};

/**
 * 公開画面(A0・A9・A10・A11)の導線(docs/screen-requirements-public.md 2章)。
 *
 * 未ログインなら「ログイン」「サインアップ」、ログイン中は「ダッシュボードへ」1つに差し替える。
 * **ヘッダーとA0のページ内CTA(ヒーロー・下部)を同じこのコンポーネントで作る。** 置き場所ごとに
 * 出し分けの規則を書き分けると、ヘッダーだけを直して画面の真ん中でログイン中のユーザーに
 * 「サインアップ」を勧め続ける状態になりやすい。
 *
 * **判定が確定するまではどちらも描かない。** 先に未ログイン用を描いてから差し替えると、
 * ログイン中のユーザーに一瞬「ログイン」ボタンが見える。そのぶん確定前は中身が空になるため、
 * **領域の高さをボタンと同じ寸法で固定する** — 埋まった瞬間に本文が跳ねると、読んでいる
 * 最中の位置がずれる(ページ本体は判定を待たずに描画される)。招待制の注記も同じ理由で、
 * **出す設定のときは文字が入る前から1行分の高さを確保する。**
 *
 * 注記(`withInviteOnlyNotice`)は登録の案内なので、文字が入るのは未ログインのときだけ。
 */
export const PublicAuthActions = ({
  size = "sm",
  withInviteOnlyNotice = false,
}: PublicAuthActionsProps): JSX.Element => {
  const [sessionState, setSessionState] = useState<PublicSessionState>("checking");

  useEffect(() => subscribeToPublicSessionState(setSessionState), []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2",
          ACTIONS_MIN_HEIGHT_CLASS[size],
        )}
      >
        {sessionState === "signed-in" ? (
          <Button asChild size={size} className={BUTTON_CLASS[size]}>
            <Link href={DASHBOARD_PATH}>ダッシュボードへ</Link>
          </Button>
        ) : null}

        {sessionState === "signed-out" ? (
          <>
            <Button
              asChild
              size={size}
              variant={SECONDARY_VARIANT[size]}
              className={BUTTON_CLASS[size]}
            >
              <Link href={LOGIN_PATH}>ログイン</Link>
            </Button>
            <Button asChild size={size} className={BUTTON_CLASS[size]}>
              <Link href={SIGNUP_PATH}>サインアップ</Link>
            </Button>
          </>
        ) : null}
      </div>

      {withInviteOnlyNotice ? (
        <p className="min-h-4 text-xs text-muted-foreground">
          {sessionState === "signed-out" ? INVITE_ONLY_NOTICE : null}
        </p>
      ) : null}
    </div>
  );
};
