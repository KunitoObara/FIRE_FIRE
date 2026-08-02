import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産詳細 | FIRE-FIRE",
};

/**
 * B6 不動産詳細画面のプレースホルダ。
 *
 * B5の物件行の遷移先が404にならないよう、画面だけ先に置いている。物件IDは`[id]`で受けるが、
 * 表示する内容がまだ無いためここでは使わない。
 *
 * 静的な`/real-estate/new`(B7)はこの動的セグメントより優先されるため、`new`という
 * IDの物件がこの画面に来ることはない。
 */
const RealEstateDetailPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B6"
    screenName="不動産詳細画面"
    purpose="物件の詳細情報と利ざや(時価-ローン残高)を確認する"
  />
);

export default RealEstateDetailPage;
