import { DashboardPreview } from "@/components/public/DashboardPreview";
import { PublicAuthActions } from "@/components/public/PublicAuthActions";
import { TOP_BETA_NOTES, TOP_FEATURES, TOP_STEPS } from "@/constants/public";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "FIRE-FIRE | 自分の資産を、自分の分類で数える。",
  description:
    "マネーフォワードからエクスポートしたCSVを取り込み、資産の推移・不動産と負債を含めた純資産・FIREの到達予測日を1枚のダッシュボードにまとめる、個人のためのFIRE資産管理ツールです。",
};

/**
 * A0 サービストップページ(docs/screen-requirements-public.md A0)。
 *
 * 未ログインの訪問者にサービスの内容を伝え、A1・A4へ送り出す。セクションの並びは要件の
 * 「セクション構成」のとおり(ヒーロー → できること → 使い方 → ベータ版について → 下部CTA)で、
 * ヘッダーとフッターは公開用シェル(`(public)/layout.tsx`)が持つ。
 *
 * **ログイン中に開いてもB1へリダイレクトしない**(2章)。変わるのは`PublicAuthActions`が出す
 * 導線だけで、ヘッダー・ヒーロー・下部CTAの3箇所とも同じコンポーネントが差し替える。
 * B1へ自動で飛ばすと、ログイン中はこの画面とフッターの規約へ入れなくなる。
 *
 * **ベータ版であることは2箇所に書く** — ヒーローのバッジと「ご利用にあたって」。バッジだけだと
 * 読み飛ばされ、セクションだけだと下までスクロールした人にしか届かない。
 */
const TopPage = (): JSX.Element => (
  <>
    {/*
      1. ヒーロー。
      背景の淡いにじみは`color-mix`で作る。テーマの色は`oklch(...)`の完成した色として
      定義されているため(`globals.css`)、モックのような`hsl(var(--primary) / 0.10)`の
      書き方はここでは効かない。
    */}
    <section className="border-b bg-[radial-gradient(60rem_30rem_at_50%_-10rem,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)]">
      <div className="mx-auto max-w-4xl px-6 pt-18 pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          ベータ版
        </span>

        <h1 className="mt-5 text-4xl leading-snug font-bold tracking-tight md:text-[2.75rem]">
          自分の資産を、
          <br className="sm:hidden" />
          自分の分類で数える。
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-loose text-muted-foreground">
          マネーフォワードからエクスポートしたCSVを取り込むだけ。資産の推移、不動産と負債を含めた純資産、そしてFIREの到達予測日までを1枚のダッシュボードにまとめる、個人のためのFIRE資産管理ツールです。
        </p>

        <div className="mt-8">
          <PublicAuthActions size="lg" withInviteOnlyNotice />
        </div>

        <DashboardPreview />
      </div>
    </section>

    {/* 2. できること */}
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-2xl font-bold tracking-tight">できること</h2>
      <p className="mt-3 mb-10 text-center text-sm text-muted-foreground">
        取り込んだデータを、資産を見るための形に組み直します。
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOP_FEATURES.map((feature) => (
          <div key={feature.id} className="rounded-lg border bg-card p-6">
            <div className="mb-3.5 flex size-10 items-center justify-center rounded-[0.625rem] bg-primary/10 text-primary">
              <feature.icon className="size-5" aria-hidden />
            </div>
            <h3 className="mb-2 font-semibold">{feature.title}</h3>
            <p className="text-sm leading-[1.8] text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>

    {/* 3. 使い方 */}
    <section className="mx-auto max-w-5xl px-6 pb-16">
      <h2 className="text-center text-2xl font-bold tracking-tight">使い方</h2>
      <p className="mt-3 mb-10 text-center text-sm text-muted-foreground">
        入力しなおす作業はありません。すでにある明細をそのまま使います。
      </p>

      <ol className="mx-auto flex max-w-2xl flex-col gap-5">
        {TOP_STEPS.map((step, index) => (
          <li key={step.id} className="flex gap-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[0.8125rem] font-bold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div>
              <p className="mb-1 font-semibold">{step.title}</p>
              <p className="text-sm leading-[1.8] text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

    {/* 4. ベータ版について(ベータ版であることの明記・その2) */}
    <section className="mx-auto max-w-5xl px-6 pb-16">
      <div className="mx-auto max-w-3xl rounded-lg border bg-card p-7">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            ベータ版
          </span>
          <h2 className="font-bold">ご利用にあたって</h2>
        </div>

        <ul className="flex flex-col gap-3">
          {TOP_BETA_NOTES.map((note) => (
            <li key={note.id} className="text-sm leading-[1.8] text-muted-foreground">
              <span className="font-semibold text-foreground">{note.lead}</span> {note.body}
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* 5. 下部CTA。ヒーローと同じ導線をもう一度置く */}
    <section className="border-y bg-secondary">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">まずは手元のCSVから。</h2>
        <p className="mt-3 mb-7 text-sm text-muted-foreground">
          取り込んだその日から、資産の全体像が1枚で見えるようになります。
        </p>
        <PublicAuthActions size="lg" />
      </div>
    </section>
  </>
);

export default TopPage;
