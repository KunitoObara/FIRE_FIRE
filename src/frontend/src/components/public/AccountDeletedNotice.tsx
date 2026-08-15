"use client";

import { useEffect, useState } from "react";

import { ACCOUNT_DELETED_NOTICE } from "@/constants/public";
import { clearAccountDeletedNotice, wasAccountDeleted } from "@/lib/auth/account-deleted-notice";

import type { JSX } from "react";

/**
 * A0に「アカウントを削除しました」を1回だけ出す(docs/auth-login-requirements.md 3.11)。
 *
 * B10の削除が成功するとA0へ置き換えて遷移してくる。**遷移先で何も出ないと、削除できたのか
 * 途中で失敗したのかが分からない**ため、公開トップの先頭に1回だけ出す。
 *
 * 読み出しは`useState`のレイジー初期化子、消費はeffectで行う(A4の「ログアウトしました」と
 * 同じ形。`src/components/auth/LoginForm.tsx`)。`wasAccountDeleted`は副作用が無いため、
 * React Strict Modeで初期化子が2回呼ばれても安全である。
 */
export const AccountDeletedNotice = (): JSX.Element | null => {
  const [showNotice] = useState(() => wasAccountDeleted());

  useEffect(() => {
    if (showNotice) {
      clearAccountDeletedNotice();
    }
  }, [showNotice]);

  if (!showNotice) {
    return null;
  }

  return (
    <p role="status" className="border-b bg-muted px-6 py-3 text-center text-sm">
      {ACCOUNT_DELETED_NOTICE}
    </p>
  );
};
