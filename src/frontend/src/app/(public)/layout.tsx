import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

import type { JSX } from "react";

/**
 * 公開画面(A0・A9・A10・A11)共通のシェル(DESIGN.md 5章)。
 *
 * 認証系の中央寄せカード(A1〜A8)でもダッシュボードのシェル(B1〜B11)でもない3つ目の系統で、
 * 上部ヘッダー + 縦積みのセクション + フッターという一般的なランディングページの形を採る。
 * 横幅の制限は各セクション側に持たせる(A0のヒーローは幅いっぱいの背景を敷くため)。
 *
 * **`AppAccessGuard`を通さない。** この4画面はログインを要求せず、メール未確認・2FA未登録の
 * 状態でもそのまま表示する(docs/screen-requirements-public.md 2章)。Firestoreも一切
 * 読まないため`QueryProvider`も要らない。
 */
const PublicLayout = ({ children }: PublicShellProps): JSX.Element => (
  <div className="flex flex-1 flex-col">
    <PublicHeader />
    <main className="flex-1">{children}</main>
    <PublicFooter />
  </div>
);

export default PublicLayout;
