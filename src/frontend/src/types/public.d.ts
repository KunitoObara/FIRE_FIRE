import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

declare global {
  /**
   * 公開画面(A0・A9・A10・A11)のヘッダー・CTAに出す導線の判定状態
   * (docs/screen-requirements-public.md 2章)。
   *
   * `checking`を独立した状態として持つのは、**確定するまでどちらの導線も描かない**ため。
   * 真偽値1つで持つと未確定を未ログインと同じ扱いにするしかなく、ログイン中のユーザーに
   * 一瞬「ログイン」ボタンが見える。
   */
  type PublicSessionState = "checking" | "signed-in" | "signed-out";

  /** 公開画面の共通シェルのProps */
  type PublicShellProps = {
    children: ReactNode;
  };

  /** 規約・ポリシー(A9・A10)の本文の器のProps */
  type LegalDocumentProps = {
    /** 見出し(例: `利用規約`) */
    title: string;
    /** 条文・本文。見出しと本文の体裁はこのコンポーネントが与える */
    children: ReactNode;
  };

  /**
   * 公開画面の導線の大きさ。
   *
   * ヘッダーは `sm`、A0のページ内CTA(ヒーロー・下部)は `lg`。判定確定前に確保する領域の
   * 高さもこれで決まるため、ボタンの高さと1対1で対応させる。
   */
  type PublicAuthActionsSize = "sm" | "lg";

  /** 公開画面の導線のProps */
  type PublicAuthActionsProps = {
    /** 既定は `sm`(ヘッダー) */
    size?: PublicAuthActionsSize;
    /**
     * 招待制の注記を導線の下に添えるか。既定は `false`。
     *
     * 登録の案内なので、未ログインのときだけ出る(A0のヒーローでのみ使う)。
     */
    withInviteOnlyNotice?: boolean;
  };

  /** A0「できること」の1項目 */
  type TopFeature = {
    id: string;
    icon: LucideIcon;
    title: string;
    description: string;
  };

  /** A0「使い方」の1ステップ。表示上の番号は並び順から振る */
  type TopStep = {
    id: string;
    title: string;
    description: string;
  };

  /** A0「ご利用にあたって」の1項目 */
  type TopBetaNote = {
    id: string;
    /** 太字で出す一文(例: `開発中のサービスです。`) */
    lead: string;
    body: string;
  };
}
