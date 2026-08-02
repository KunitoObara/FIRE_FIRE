import { RealEstateEditScreen } from "@/components/real-estate/RealEstateEditScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産編集 | FIRE-FIRE",
};

/**
 * B7 不動産登録・編集画面(編集モード、docs/screen-requirements-real-estate.md B7)。
 *
 * B6の「編集」ボタンから遷移する。既存の登録値をプリセットするため対象の物件を取得するが、
 * 取得はブラウザ側でしかできないので、ここでは`[id]`を渡すだけにしている。
 */
const RealEstateEditPage = async ({
  params,
}: RealEstatePropertyPageProps): Promise<JSX.Element> => {
  const { id } = await params;

  return <RealEstateEditScreen propertyId={id} />;
};

export default RealEstateEditPage;
