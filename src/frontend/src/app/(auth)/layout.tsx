import type { JSX, ReactNode } from "react";

/**
 * 認証系画面(A1〜A8)共通のシェル。
 * DESIGN.md 5章のとおり、共通ヘッダー/サイドバーを持たない中央寄せ1カラムのレイアウトとする。
 */
const AuthLayout = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className="flex flex-1 items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

export default AuthLayout;
