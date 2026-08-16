import Link from "next/link";

import { CONTACT_LINK_LABEL, COPYRIGHT_NOTICE } from "@/constants/public";
import { CONTACT_PATH, PRIVACY_PATH, TERMS_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * 公開画面(A0・A9・A10・A11)の共通フッター(docs/screen-requirements-public.md A0)。
 *
 * 置くのはコピーライトと規約2本、それにA11 お問い合わせへのリンクだけ。**A0へ戻る導線は
 * 置かない**(ヘッダーのロゴがその役目を持つ)。規約を読んでいる人がフッターまで到達した
 * ときに欲しいのは、トップページではなくもう一方の規約である
 * (docs/screen-list-and-transitions.md 3.4)。
 *
 * お問い合わせは規約ではないため、`nav`を分ける(読み上げたときに「規約」の一覧に
 * 混ざらないようにする)。
 *
 * ヘルプページ([X2])は未着手のため、枠だけ置くことはしない
 * (docs/screen-requirements-public.md 3章)。
 */
export const PublicFooter = (): JSX.Element => (
  <footer className="border-t bg-muted">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[0.8125rem] text-muted-foreground">
      <p>{COPYRIGHT_NOTICE}</p>

      <div className="flex flex-wrap items-center gap-5">
        <nav aria-label="規約" className="flex flex-wrap gap-5">
          <Link href={TERMS_PATH} className="underline underline-offset-4 hover:text-foreground">
            利用規約
          </Link>
          <Link href={PRIVACY_PATH} className="underline underline-offset-4 hover:text-foreground">
            プライバシーポリシー
          </Link>
        </nav>

        <Link href={CONTACT_PATH} className="underline underline-offset-4 hover:text-foreground">
          {CONTACT_LINK_LABEL}
        </Link>
      </div>
    </div>
  </footer>
);
