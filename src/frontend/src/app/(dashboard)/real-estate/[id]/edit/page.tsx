import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産編集 | FIRE-FIRE",
};

/**
 * B7 不動産登録・編集画面(編集モード)のプレースホルダ。
 *
 * B6の「編集」ボタンの遷移先が404にならないよう、画面だけ先に置いている。編集対象の物件IDは
 * `[id]`で受けるが、プリセットする既存値を表示する実装がまだ無いためここでは使わない。
 *
 * 新規登録モード(`/real-estate/new`)と合わせて、B7を実装するカードで中身を差し替える。
 */
const RealEstateEditPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B7"
    screenName="不動産登録・編集画面(編集モード)"
    purpose="登録済みの物件基本情報・時価・ローン残高・(収益物件の場合)賃貸収入/支出を編集する"
  />
);

export default RealEstateEditPage;
