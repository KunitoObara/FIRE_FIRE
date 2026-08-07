import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { GoogleLinkFailureNotice } from "@/components/dashboard/GoogleLinkFailureNotice";
import { DASHBOARD_AXIS_PARAM, DASHBOARD_PERIOD_PARAM } from "@/constants/dashboard";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "ダッシュボード | FIRE-FIRE",
};

/**
 * B1 ダッシュボード画面(docs/screen-requirements-dashboard.md B1)。
 *
 * 表示データはFirestoreから読むためClient Component(`DashboardScreen`)側で取得する。
 * この画面が受け持つのは、分類軸・表示期間のクエリパラメータの受け取りだけ。
 * `useSearchParams`を使うとSuspense境界が要る(Next.jsのuseSearchParamsドキュメント)ため、
 * A7と同じくServer Component側でクエリを取り出して渡す。
 *
 * A8経由のログインで起こりうる「Googleアカウント連携の失敗通知」(同要件のB1)は、
 * `GoogleLinkFailureNotice`がトーストで出す。連携失敗が無ければ何もしない。
 */
const DashboardPage = async (props: PageProps<"/dashboard">): Promise<JSX.Element> => {
  const searchParams = await props.searchParams;

  return (
    <>
      <GoogleLinkFailureNotice />
      <DashboardScreen
        axisParam={searchParams[DASHBOARD_AXIS_PARAM]}
        periodParam={searchParams[DASHBOARD_PERIOD_PARAM]}
      />
    </>
  );
};

export default DashboardPage;
