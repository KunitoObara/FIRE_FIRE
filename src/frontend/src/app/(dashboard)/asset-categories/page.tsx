import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { JSX } from "react";

const AssetCategoriesPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B4"
    screenName="資産分類マスタ設定画面"
    purpose="資産分類軸(総資産、純金融資産、投資性資産等)をユーザーが追加・編集・削除できる"
  />
);

export default AssetCategoriesPage;
