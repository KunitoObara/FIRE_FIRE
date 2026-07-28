import { MfaSetupForm } from "@/components/auth/MfaSetupForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "2段階認証の設定 | FIRE-FIRE",
};

/**
 * A3 2FA登録画面(docs/screen-requirements-auth.md A3)。
 * QRコードの発行も確認コードの検証もクライアント側で扱うため、実体は MfaSetupForm に委ねる。
 */
const MfaSetupPage = (): JSX.Element => <MfaSetupForm />;

export default MfaSetupPage;
