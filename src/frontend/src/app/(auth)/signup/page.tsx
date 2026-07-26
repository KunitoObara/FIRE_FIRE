import { SignupForm } from "@/components/auth/SignupForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "アカウント作成 | FIRE-FIRE",
};

/**
 * A1 サインアップ画面(docs/screen-requirements-auth.md A1)。
 * 入力とバリデーションはクライアント側で扱うため、実体は SignupForm に委ねる。
 */
const SignupPage = (): JSX.Element => <SignupForm />;

export default SignupPage;
