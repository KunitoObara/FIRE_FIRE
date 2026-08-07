"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

import { PASSWORD_RULES } from "@/constants/password";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/**
 * パスワードポリシーの充足状況をリアルタイムに表示する
 * (docs/auth-login-requirements.md 6章)。A1サインアップとA7パスワード再設定で共通に使う。
 */
export const PasswordPolicyChecklist = ({
  password,
}: PasswordPolicyChecklistProps): JSX.Element => (
  <ul aria-label="パスワードの条件" className="flex flex-col gap-1">
    {PASSWORD_RULES.map((rule) => {
      const satisfied = rule.satisfiedBy(password);

      return (
        <li
          key={rule.id}
          data-satisfied={satisfied}
          className={cn(
            "flex items-center gap-1.5 text-sm",
            satisfied ? "text-primary" : "text-muted-foreground",
          )}
        >
          {satisfied ? (
            <CheckIcon aria-hidden className="size-3.5" />
          ) : (
            <CircleIcon aria-hidden className="size-3.5" />
          )}
          {rule.label}
          <span className="sr-only">
            {satisfied ? "条件を満たしています" : "条件を満たしていません"}
          </span>
        </li>
      );
    })}
  </ul>
);
