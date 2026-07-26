"use client";

import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { JSX } from "react";

import "@/lib/fontawesome";

/**
 * 表示/非表示を切り替えられるパスワード入力欄。
 * 入力欄の右端のアイコンで平文表示をトグルする。A1・A7で共通に使う。
 */
export const PasswordField = ({
  id,
  label,
  registration,
  error,
  children,
}: PasswordFieldProps): JSX.Element => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      <div className="relative">
        <Input
          id={id}
          type={isVisible ? "text" : "password"}
          autoComplete="new-password"
          aria-invalid={error !== undefined}
          className="pr-9"
          {...registration}
        />
        <button
          type="button"
          // 状態は aria-pressed だけで伝える。ラベルも状態で切り替えると
          // 「パスワードを表示、押されている」のように二重に読み上げられるため固定する
          aria-label="パスワードを表示"
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setIsVisible((visible) => !visible)}
        >
          <FontAwesomeIcon icon={isVisible ? faEyeSlash : faEye} />
        </button>
      </div>

      <FieldError errors={[error]} />

      {children}
    </Field>
  );
};
