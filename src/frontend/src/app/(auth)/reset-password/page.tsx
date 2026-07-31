import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { firstQueryValue } from "@/lib/query-params";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "パスワード再設定 | FIRE-FIRE",
};

/**
 * A7 パスワード再設定画面(docs/screen-requirements-auth.md A7)。
 *
 * リセットメールのリンク(`/auth/action?mode=resetPassword`)から`oobCode`付きで到達する。
 * クエリはここで取り出してクライアントへ渡す。`useSearchParams`を使うと
 * Suspense境界が要る(Next.jsのuseSearchParamsドキュメント)ため、Server Component側で受ける。
 */
const ResetPasswordPage = async ({
  searchParams,
}: PageProps<"/reset-password">): Promise<JSX.Element> => {
  const { oobCode } = await searchParams;

  return <ResetPasswordForm oobCode={firstQueryValue(oobCode)} />;
};

export default ResetPasswordPage;
