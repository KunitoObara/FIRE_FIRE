import "@fortawesome/fontawesome-svg-core/styles.css";

import { Geist_Mono, Noto_Sans_JP } from "next/font/google";

import "./globals.css";

import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

// DESIGN.md 4章: UIは全て日本語。和文フォントをnext/font経由で最適化配信する。
// Noto Sans JPの日本語グリフはGoogle Fonts側で名前付きサブセットを持たないため、
// `subsets` にはプリロード対象のlatinのみを指定する(日本語グリフは非プリロードで配信される)。
const notoSansJp = Noto_Sans_JP({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FIRE-FIRE",
  description: "パーソナルFIRE資産管理アプリ",
  /*
    ベータ版・単一ユーザー運用の間は検索流入を集めない(docs/screen-requirements-public.md 2章)。
    **A0だけでなくサイト全体に掛ける** — A0にだけ掛けると、A1 サインアップ画面などが単独で
    インデックスされうる。トップページが検索に出ないのに登録画面だけが出る状態は、掛けないより悪い。
    ルートレイアウトに置くのは、これがサイト内の全ページに継承される唯一の場所であるため。

    外すのは「正式公開」の判断とセットで行う([X4] https://trello.com/c/8wpkp9Gt)。
    なお`noindex`はクロールの禁止ではない。ログイン後のデータを守っているのは`firestore.rules`と
    認証であって、この設定ではない。

    `follow`は指定しない(出力は`noindex`のみ)。要件とモックが求めているのはインデックスの
    抑止だけで、リンクを辿らせない理由が無いため。
  */
  robots: { index: false },
};

/**
 * `suppressHydrationWarning` は `<html>` 要素そのものの属性差分だけを許容する。
 * ブラウザ拡張がハイドレーション前に `<html>` へ独自属性を足すとサーバーの出力と
 * 一致せずハイドレーションエラーになるため、この1要素に限って差分を無視する。
 * 効果は1階層のみで、配下のコンポーネントの不一致は従来どおり検出される。
 */
const RootLayout = ({ children }: Readonly<{ children: ReactNode }>): JSX.Element => (
  <html
    lang="ja"
    className={`${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}
    suppressHydrationWarning
  >
    <body className="flex min-h-full flex-col">{children}</body>
  </html>
);

export default RootLayout;
