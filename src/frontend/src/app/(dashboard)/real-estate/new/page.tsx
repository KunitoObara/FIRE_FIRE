import { RealEstateNewScreen } from "@/components/real-estate/RealEstateNewScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産登録 | FIRE-FIRE",
};

/**
 * B7 不動産登録・編集画面(新規登録モード、docs/screen-requirements-real-estate.md B7)。
 *
 * B5の「新規登録」ボタンから遷移する。編集モードは`/real-estate/[id]/edit`にあり、
 * フォーム本体(`RealEstateForm`)を両モードで共用する。
 */
const RealEstateNewPage = (): JSX.Element => <RealEstateNewScreen />;

export default RealEstateNewPage;
