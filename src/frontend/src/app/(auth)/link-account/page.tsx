import { AccountLinkForm } from "@/components/auth/AccountLinkForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "アカウント連携 | FIRE-FIRE",
};

/**
 * A8 アカウント連携画面(docs/screen-requirements-auth.md A8)。
 * 連携待ちのGoogle資格情報の受け渡しもパスワード検証もクライアント側で扱うため、
 * 実体は AccountLinkForm に委ねる。
 */
const LinkAccountPage = (): JSX.Element => <AccountLinkForm />;

export default LinkAccountPage;
