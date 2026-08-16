import { LEGAL_ENACTED_ON, LEGAL_LAST_REVISED_ON } from "@/constants/public";

import type { JSX } from "react";

/**
 * 規約・ポリシー(A9・A10)の本文の器(docs/screen-requirements-public.md A9・A10)。
 *
 * 読ませることだけが用途の画面なので、決めるのは行長と見出しの間隔だけにする。装飾は置かない。
 * 条文の体裁を2画面で揃えるため、見出し・段落・箇条書きのスタイルはここが一括で与える
 * (各画面のJSXには素の`h2`・`p`・`ol`だけが並ぶ)。
 *
 * 制定日・最終改定日は2画面で同じ値を出すため定数から引く(`src/constants/public.ts`)。
 */
export const LegalDocument = ({ title, children }: LegalDocumentProps): JSX.Element => (
  <article className="mx-auto max-w-[44rem] px-6 pt-12 pb-16">
    <h1 className="mb-2 text-2xl font-bold">{title}</h1>
    <p className="mb-8 text-[0.8125rem] text-muted-foreground">
      制定日:{LEGAL_ENACTED_ON} / 最終改定日:{LEGAL_LAST_REVISED_ON}
    </p>

    <div className="[&_h2]:mt-8 [&_h2]:mb-2.5 [&_h2]:text-base [&_h2]:font-bold [&_li]:text-sm [&_li]:leading-[1.9] [&_ol]:mb-3 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_p]:text-sm [&_p]:leading-[1.9] [&_ul]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc">
      {children}
    </div>
  </article>
);
