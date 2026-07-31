import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { JSX } from "react";

const AccountSettingsPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B10"
    screenName="アカウント設定画面"
    purpose="ログイン後にパスワード変更・2FA再設定などのアカウント関連設定を行う"
  />
);

export default AccountSettingsPage;
