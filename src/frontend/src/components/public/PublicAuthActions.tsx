"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DASHBOARD_PATH, LOGIN_PATH, SIGNUP_PATH } from "@/constants/routes";
import { subscribeToPublicSessionState } from "@/lib/auth/public-session";

import type { JSX } from "react";

/**
 * 公開画面(A0・A9・A10)の導線(docs/screen-requirements-public.md 2章)。
 *
 * 未ログインなら「ログイン」「サインアップ」、ログイン中は「ダッシュボードへ」1つに差し替える。
 * **ヘッダーとA0のページ内CTA(ヒーロー・下部)を同じこのコンポーネントで作る。** 置き場所ごとに
 * 出し分けの規則を書き分けると、ヘッダーだけを直して画面の真ん中でログイン中のユーザーに
 * 「サインアップ」を勧め続ける状態になりやすい。
 *
 * **判定が確定するまではどちらも描かない。** 先に未ログイン用を描いてから差し替えると、
 * ログイン中のユーザーに一瞬「ログイン」ボタンが見える。そのぶん確定前は中身が空になるため、
 * **領域の高さはボタンと同じ`h-7`で固定する** — 埋まった瞬間に本文が跳ねると、読んでいる
 * 最中の位置がずれる(ページ本体は判定を待たずに描画される)。
 */
export const PublicAuthActions = (): JSX.Element => {
  const [sessionState, setSessionState] = useState<PublicSessionState>("checking");

  useEffect(() => subscribeToPublicSessionState(setSessionState), []);

  return (
    <div className="flex h-7 items-center gap-2">
      {sessionState === "signed-in" ? (
        <Button asChild size="sm">
          <Link href={DASHBOARD_PATH}>ダッシュボードへ</Link>
        </Button>
      ) : null}

      {sessionState === "signed-out" ? (
        <>
          <Button asChild size="sm" variant="ghost">
            <Link href={LOGIN_PATH}>ログイン</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={SIGNUP_PATH}>サインアップ</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
};
