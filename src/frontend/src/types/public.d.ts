import type { ReactNode } from "react";

declare global {
  /**
   * 公開画面(A0・A9・A10)のヘッダー・CTAに出す導線の判定状態
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
}
