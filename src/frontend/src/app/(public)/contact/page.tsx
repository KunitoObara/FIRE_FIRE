import { ContactForm } from "@/components/public/ContactForm";
import { CONTACT_DESCRIPTION, CONTACT_TITLE } from "@/constants/public";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "お問い合わせ | FIRE-FIRE",
};

/**
 * A11 お問い合わせ画面(docs/screen-requirements-public.md A11)。
 *
 * **A0とは別の画面にしてある。** A0には入力欄を置かない方針(同 A0)で、フォームを載せると
 * それを崩す。フッターとA10から辿れれば足りる導線でもある。
 *
 * 認証を要求しない公開画面で、Firestoreも読まない。送信はCallable
 * (`sendContactMessage`)がすべて引き受け、宛先はサーバー側のシークレットにだけ置く
 * — 公開リポジトリに開発者のアドレスを書けないため(CLAUDE.md)。
 */
const ContactPage = (): JSX.Element => (
  <div className="mx-auto max-w-[36rem] px-6 pt-12 pb-16">
    <h1 className="mb-2 text-2xl font-bold">{CONTACT_TITLE}</h1>
    <p className="mb-8 text-sm leading-[1.9] text-muted-foreground">{CONTACT_DESCRIPTION}</p>

    <ContactForm />
  </div>
);

export default ContactPage;
