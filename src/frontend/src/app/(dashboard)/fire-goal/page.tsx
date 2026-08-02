import { FireGoalScreen } from "@/components/fire-goal/FireGoalScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "FIRE目標設定 | FIRE-FIRE",
};

/** B8 FIRE目標設定画面(docs/screen-requirements-fire-goal.md B8) */
const FireGoalPage = (): JSX.Element => <FireGoalScreen />;

export default FireGoalPage;
