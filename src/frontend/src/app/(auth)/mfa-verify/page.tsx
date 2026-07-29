import { MfaVerifyForm } from "@/components/auth/MfaVerifyForm";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "2段階認証 | FIRE-FIRE",
};

/**
 * A5 2FA検証画面(docs/screen-requirements-auth.md A5)。
 * 検証セッションの受け渡しも確認コードの検証もクライアント側で扱うため、実体は MfaVerifyForm に委ねる。
 */
const MfaVerifyPage = (): JSX.Element => <MfaVerifyForm />;

export default MfaVerifyPage;
