import { AccountSettingsScreen } from "@/components/account/AccountSettingsScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "アカウント設定 | FIRE-FIRE",
};

/** B10 アカウント設定画面(docs/screen-requirements-account.md B10) */
const AccountSettingsPage = (): JSX.Element => <AccountSettingsScreen />;

export default AccountSettingsPage;
