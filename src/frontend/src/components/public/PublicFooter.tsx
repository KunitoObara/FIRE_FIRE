import Link from "next/link";

import { CONTACT_LINK_LABEL, COPYRIGHT_NOTICE, HELP_LINK_LABEL } from "@/constants/public";
import { CONTACT_PATH, HELP_PATH, PRIVACY_PATH, TERMS_PATH } from "@/constants/routes";

import type { JSX } from "react";

/**
 * 公開画面(A0・A9・A10・A11・A12)の共通フッター(docs/screen-requirements-public.md A0)。
 *
 * 置くのはコピーライトと規約2本、それにA12 ヘルプ・A11 お問い合わせへのリンク。**A0へ戻る
 * 導線は置かない**(ヘッダーのロゴがその役目を持つ)。規約を読んでいる人がフッターまで
 * 到達したときに欲しいのは、トップページではなくもう一方の規約である
 * (docs/screen-list-and-transitions.md 3.4)。
 *
 * ヘルプ・お問い合わせは規約ではないため、`nav`を分ける(読み上げたときに「規約」の一覧に
 * 混ざらないようにする)。
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

        <Link href={HELP_PATH} className="underline underline-offset-4 hover:text-foreground">
          {HELP_LINK_LABEL}
        </Link>

        <Link href={CONTACT_PATH} className="underline underline-offset-4 hover:text-foreground">
          {CONTACT_LINK_LABEL}
        </Link>
      </div>
    </div>
  </footer>
);
