import { LoginForm } from "@/components/auth/LoginForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "ログイン | FIRE-FIRE",
};

/**
 * A4 ログイン画面(docs/screen-requirements-auth.md A4)。
 * 入力とバリデーションはクライアント側で扱うため、実体は LoginForm に委ねる。
 */
const LoginPage = (): JSX.Element => <LoginForm />;

export default LoginPage;
