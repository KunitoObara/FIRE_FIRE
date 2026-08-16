import { TransactionsScreen } from "@/components/transactions/TransactionsScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "収支明細一覧 | FIRE-FIRE",
};

/**
 * B3 収支明細一覧画面(docs/screen-requirements-dashboard.md B3)。
 *
 * 表示データはFirestoreから読むためClient Component(`TransactionsScreen`)側で取得する。
 * この画面が受け持つのは、絞り込み・並び替え・ページのクエリパラメータの受け取りだけ。
 * `useSearchParams`を使うとSuspense境界が要る(Next.jsのuseSearchParamsドキュメント)ため、
 * B1と同じくServer Component側でクエリを取り出して渡す。
 */
const TransactionsPage = async (props: PageProps<"/transactions">): Promise<JSX.Element> => {
  const searchParams = await props.searchParams;

  return <TransactionsScreen searchParams={searchParams} />;
};

export default TransactionsPage;
