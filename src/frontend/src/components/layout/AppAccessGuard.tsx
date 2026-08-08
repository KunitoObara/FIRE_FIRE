"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  APP_ACCESS_CHECKING_NOTICE,
  APP_ACCESS_REDIRECTS,
  APP_ACCESS_REDIRECT_NOTICES,
  FIREBASE_CONFIGURATION_MESSAGE,
} from "@/constants/auth";
import {
  APP_ACCESS_GUARD_BYPASS_HOW_TO_DISABLE,
  APP_ACCESS_GUARD_BYPASS_NOTICE,
  isAppAccessGuardBypassed,
} from "@/constants/dev";
import { subscribeToAppAccessState } from "@/lib/auth/app-access";

import type { JSX } from "react";

/** 判定中・遷移待ちの間に出す案内。シェルを組み立てる前の状態なので中央寄せの1カラムにする */
const AppAccessNotice = ({ message }: AppAccessNoticeProps): JSX.Element => (
  <div className="flex flex-1 items-center justify-center px-4 py-10">
    <p role="status" className="text-sm text-muted-foreground">
      {message}
    </p>
  </div>
);

/**
 * 認証ガードを迂回中であることを示す帯。
 *
 * ログイン済みだと勘違いしたまま画面を確認すると認証まわりの不具合を見落とすため、
 * 迂回中は画面の一番上に必ず出す。本番ビルドではこの分岐ごと消える(`src/constants/dev.ts`)。
 */
const AppAccessBypassBanner = (): JSX.Element => (
  <p role="status" className="bg-destructive px-4 py-2 text-center text-xs text-primary-foreground">
    {APP_ACCESS_GUARD_BYPASS_NOTICE}
    <span className="ml-2 opacity-80">{APP_ACCESS_GUARD_BYPASS_HOW_TO_DISABLE}</span>
  </p>
);

/**
 * ログイン後画面(B1〜B11)の表示可否を判定するガード。
 *
 * 認証フローを飛ばして直接URLを叩かれた場合に、未完了の手順の画面へ戻す
 * (docs/screen-list-and-transitions.md の認証フロー)。判定そのものは
 * `src/lib/auth/app-access.ts` にあり、ここは結果を画面に反映するだけにしてある。
 *
 * **これは表示制御であって、データの保護ではない。** 認証状態はFirebaseのクライアントSDKが
 * ブラウザ側で持つものなので、このガードはブラウザ内で無効化できてしまう。実データを守るのは
 * Firestoreのセキュリティルール(`firestore.rules`)とCloud Functions側の検証であり、
 * データを繋ぎ込む際もそちらを正とする。
 */
export const AppAccessGuard = ({ children }: AppAccessGuardProps): JSX.Element => {
  const router = useRouter();
  const [state, setState] = useState<AppAccessState>("checking");

  useEffect(() => subscribeToAppAccessState(setState), []);

  useEffect(() => {
    if (state === "checking" || state === "ready" || state === "configuration-error") {
      return;
    }

    // 未完了の手順へ戻す遷移なので、ブラウザの「戻る」で入れない画面に戻れても意味がない
    router.replace(APP_ACCESS_REDIRECTS[state]);
  }, [router, state]);

  if (state === "configuration-error") {
    return <AppAccessNotice message={FIREBASE_CONFIGURATION_MESSAGE} />;
  }

  if (state === "checking") {
    return <AppAccessNotice message={APP_ACCESS_CHECKING_NOTICE} />;
  }

  if (state !== "ready") {
    return <AppAccessNotice message={APP_ACCESS_REDIRECT_NOTICES[state]} />;
  }

  if (isAppAccessGuardBypassed()) {
    return (
      <>
        <AppAccessBypassBanner />
        {children}
      </>
    );
  }

  return <>{children}</>;
};
