import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "パスワードをお忘れの方 | FIRE-FIRE",
};

/**
 * A6 パスワードをお忘れの方画面(docs/screen-requirements-auth.md A6)。
 * 入力とバリデーションはクライアント側で扱うため、実体は ForgotPasswordForm に委ねる。
 */
const ForgotPasswordPage = (): JSX.Element => <ForgotPasswordForm />;

export default ForgotPasswordPage;
