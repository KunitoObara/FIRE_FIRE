import Link from "next/link";

import { PublicAuthActions } from "@/components/public/PublicAuthActions";
import { APP_NAME } from "@/constants/navigation";
import { TOP_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * 公開画面(A0・A9・A10・A11)の共通ヘッダー(DESIGN.md 5章)。
 *
 * スクロールに追従させる。A0は縦に長く、下まで読み終えたところでそのまま導線へ入れる状態を
 * 保つため。**モバイル幅でもハンバーガーメニューにしない** — 畳む対象が最大2つしか無い
 * (docs/screen-requirements-public.md 2章)。
 *
 * ロゴはA0へ戻る導線を兼ねる。A9・A10からトップへ戻れるのはここだけである
 * (フッターには規約2本しか置かない。docs/screen-list-and-transitions.md 3.4)。
 */
export const PublicHeader = (): JSX.Element => (
  <header className="sticky top-0 z-30 flex h-15 shrink-0 items-center justify-between gap-4 border-b bg-background/85 px-6 backdrop-blur">
    <Link
      href={TOP_PATH}
      className="inline-flex items-center gap-2 text-[1.0625rem] font-bold tracking-tight"
    >
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-[0.8125rem] font-bold text-primary-foreground"
      >
        FF
      </span>
      {APP_NAME}
    </Link>

    {/* ログイン中は「ダッシュボードへ」1つに差し替わるため、ラベルは状態に依らない言い方にする */}
    <nav aria-label="ヘッダーの導線">
      <PublicAuthActions />
    </nav>
  </header>
);
