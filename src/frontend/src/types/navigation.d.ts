import type { LucideIcon } from "lucide-react";

declare global {
  /** ログイン後の共通サイドバーに並べる1項目 */
  type PrimaryNavItem = {
    /** docs/screen-list-and-transitions.md の画面ID(B1〜B11) */
    screenId: string;
    /** サイドバーとヘッダーの両方で使う画面名 */
    label: string;
    path: string;
    icon: LucideIcon;
  };

  /** サイドバー内で区切り線で分けるグループ */
  type PrimaryNavGroup = {
    /** グループを識別するキー。見出しは出さないため表示には使わない */
    id: string;
    items: PrimaryNavItem[];
  };
}
