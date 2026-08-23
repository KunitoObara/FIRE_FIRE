import type { ReactNode } from "react";

declare global {
  /** ログイン後画面のガードのProps */
  type AppAccessGuardProps = {
    /** 判定が`ready`になったときにだけ描画する中身 */
    children: ReactNode;
  };

  /** ログイン後の共通シェルのProps */
  type AppShellProps = {
    children: ReactNode;
  };

  /** TanStack QueryのプロバイダのProps */
  type QueryProviderProps = {
    children: ReactNode;
  };

  /** 判定中・遷移待ちに出す案内のProps */
  type AppAccessNoticeProps = {
    message: string;
  };

  /**
   * ルートレイアウトごと巻き込んだ描画エラーの受け皿(`app/global-error.tsx`)のProps。
   *
   * 形はNext.jsの規約で決まっている — `digest`は本番ビルドでサーバー側の
   * エラーに付く識別子で、クライアント側のエラーには付かないため任意。
   */
  type GlobalErrorProps = {
    error: Error & { digest?: string };
    /** 同じルートの再描画を試みる。Next.jsが渡す */
    reset: () => void;
  };

  /** 未実装画面のプレースホルダのProps */
  type UnimplementedScreenProps = {
    /** docs/screen-list-and-transitions.md の画面ID(例: `B2`) */
    screenId: string;
    /** 画面名(例: `CSV取込画面`) */
    screenName: string;
    /** その画面が何をする画面かの1行説明。要件定義書の「画面目的」をそのまま使う */
    purpose: string;
  };
}
