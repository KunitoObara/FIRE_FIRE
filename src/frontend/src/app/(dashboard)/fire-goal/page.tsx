import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { JSX } from "react";

const FireGoalPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B8"
    screenName="FIRE目標設定画面"
    purpose="FIRE達成目標を設定する。目標資産額の直接設定、または年間支出額からの逆算を切り替えて設定できる"
  />
);

export default FireGoalPage;
