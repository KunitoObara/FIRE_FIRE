import { AssumptionSettingsScreen } from "@/components/assumptions/AssumptionSettingsScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "想定利回り・リスク設定 | FIRE-FIRE",
};

/** B9 想定利回り・リスク設定画面(docs/screen-requirements-fire-goal.md B9) */
const AssumptionSettingsPage = (): JSX.Element => <AssumptionSettingsScreen />;

export default AssumptionSettingsPage;
