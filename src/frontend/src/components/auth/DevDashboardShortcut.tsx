import Link from "next/link";

import { APP_ACCESS_GUARD_BYPASS_NOTICE, isAppAccessGuardBypassed } from "@/constants/dev";
import { DASHBOARD_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * 開発時にログイン後の画面へ直接入るための導線(A4に表示)。
 *
 * サインアップ → メール確認 → TOTP登録を毎回通さずに、ログイン後の画面(B1〜B11)の
 * 見た目や遷移だけを素早く確認したいときのための導線。
 * `NEXT_PUBLIC_BYPASS_APP_ACCESS_GUARD` を有効にしたときだけ、ここから直接入れるようにする。
 *
 * 迂回が無効なとき、および本番ビルドでは何も描画しない(`src/constants/dev.ts`)。
 */
export const DevDashboardShortcut = (): JSX.Element | null => {
  if (!isAppAccessGuardBypassed()) {
    return null;
  }

  return (
    <div className="mt-6 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
      <p className="text-xs text-muted-foreground">{APP_ACCESS_GUARD_BYPASS_NOTICE}</p>
      <Link
        href={DASHBOARD_PATH}
        className="mt-1 inline-block text-sm underline underline-offset-4"
      >
        開発用: ログインせずダッシュボードへ
      </Link>
    </div>
  );
};
