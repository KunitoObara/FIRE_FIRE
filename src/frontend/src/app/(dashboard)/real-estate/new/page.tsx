import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産登録 | FIRE-FIRE",
};

/**
 * B7 不動産登録・編集画面(新規登録モード)のプレースホルダ。
 *
 * B5の「新規登録」ボタンの遷移先が404にならないよう、画面だけ先に置いている。
 * 編集モード(既存物件の編集)のパスはこの画面を実装するカードで決める。
 */
const RealEstateNewPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B7"
    screenName="不動産登録・編集画面"
    purpose="物件基本情報・時価・ローン残高・(収益物件の場合)賃貸収入/支出を登録・編集する"
  />
);

export default RealEstateNewPage;
