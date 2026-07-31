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

  /** 判定中・遷移待ちに出す案内のProps */
  type AppAccessNoticeProps = {
    message: string;
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
