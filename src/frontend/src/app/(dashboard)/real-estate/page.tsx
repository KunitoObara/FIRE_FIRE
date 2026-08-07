import { RealEstateListScreen } from "@/components/real-estate/RealEstateListScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産一覧 | FIRE-FIRE",
};

/**
 * B5 不動産一覧画面(docs/screen-requirements-real-estate.md B5)。
 *
 * 「新規登録」ボタンはモックでは共通ヘッダーに置かれているが、`AppHeader`は全画面共通で
 * 画面ごとのアクションを差し込む口を持たないため、B4と同じく本文の先頭に置いている
 * (実装は`RealEstateListScreen`)。
 */
const RealEstatePage = (): JSX.Element => <RealEstateListScreen />;

export default RealEstatePage;
