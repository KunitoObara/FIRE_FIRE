import {
  HELP_DESCRIPTION,
  HELP_FAQ_ITEMS,
  HELP_GLOSSARY_TERMS,
  HELP_TITLE,
  HELP_USAGE_STEPS,
} from "@/constants/public";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "ヘルプ | FIRE-FIRE",
};

/**
 * A12 ヘルプページ(docs/screen-requirements-public.md A12)。
 *
 * 未ログインの訪問者も含めて閲覧できる公開画面。A9・A10と同じ最小限の静的1ページとして実装し
 * ([X2](https://trello.com/c/tgP5d1Ue))、使い方ガイド・よくある質問・用語集の3セクションを
 * 縦に積むだけに留める。検索・カテゴリ分け・記事単位のURLは持たない。
 *
 * **用語集には資産分類そのもの(純金融資産・投資性資産等)を載せない。** B4でユーザーが
 * 自由に作れる編集可能なマスタデータであり(要件定義書 4.3)、固定の用語集に書くと決め打ちに
 * 見える。載せるのは「分類軸」という仕組みの説明までである(`HELP_GLOSSARY_TERMS`のコメント)。
 */
const HelpPage = (): JSX.Element => (
  <article className="mx-auto max-w-[44rem] px-6 pt-12 pb-16">
    <h1 className="mb-2 text-2xl font-bold">{HELP_TITLE}</h1>
    <p className="mb-10 text-sm leading-[1.9] text-muted-foreground">{HELP_DESCRIPTION}</p>

    <section className="mb-10">
      <h2 className="mb-4 text-base font-bold">使い方</h2>
      <ol className="list-decimal space-y-4 pl-5">
        {HELP_USAGE_STEPS.map((step) => (
          <li key={step.id} className="text-sm leading-[1.9]">
            <p className="font-semibold">{step.title}</p>
            <p className="text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>

    <section className="mb-10">
      <h2 className="mb-4 text-base font-bold">よくある質問</h2>
      <dl className="space-y-4">
        {HELP_FAQ_ITEMS.map((item) => (
          <div key={item.id}>
            <dt className="text-sm font-semibold">{item.question}</dt>
            <dd className="text-sm leading-[1.9] text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>

    <section>
      <h2 className="mb-4 text-base font-bold">用語集</h2>
      <dl className="space-y-4">
        {HELP_GLOSSARY_TERMS.map((entry) => (
          <div key={entry.id}>
            <dt className="text-sm font-semibold">{entry.term}</dt>
            <dd className="text-sm leading-[1.9] text-muted-foreground">{entry.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  </article>
);

export default HelpPage;
