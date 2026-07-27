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
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>): JSX.Element => (
  <html lang="ja" className={`${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}>
    <body className="flex min-h-full flex-col">{children}</body>
  </html>
);

export default RootLayout;
