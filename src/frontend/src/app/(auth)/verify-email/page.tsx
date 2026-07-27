import { VerifyEmailNotice } from "@/components/auth/VerifyEmailNotice";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "メールアドレスの確認 | FIRE-FIRE",
};

/**
 * A2 メールアドレス確認待ち画面(docs/screen-requirements-auth.md A2)。
 * 確認状況の監視と再送はクライアント側で扱うため、実体は VerifyEmailNotice に委ねる。
 */
const VerifyEmailPage = (): JSX.Element => <VerifyEmailNotice />;

export default VerifyEmailPage;
