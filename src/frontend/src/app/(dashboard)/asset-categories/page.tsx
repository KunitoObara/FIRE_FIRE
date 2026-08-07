import { AssetCategoryMasterScreen } from "@/components/asset-categories/AssetCategoryMasterScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "資産分類マスタ設定 | FIRE-FIRE",
};

/**
 * B4 資産分類マスタ設定画面(docs/screen-requirements-dashboard.md B4)。
 *
 * 資産分類軸(総資産、純金融資産、投資性資産等)をユーザーが追加・編集・削除できる画面。
 */
const AssetCategoriesPage = (): JSX.Element => <AssetCategoryMasterScreen />;

export default AssetCategoriesPage;
