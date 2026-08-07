import { RealEstateDetailScreen } from "@/components/real-estate/RealEstateDetailScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産詳細 | FIRE-FIRE",
};

/**
 * B6 不動産詳細画面(docs/screen-requirements-real-estate.md B6)。
 *
 * 物件IDは動的セグメント`[id]`で受ける。`params`が解決した時点でURLデコード済みの値が入るため
 * ここでのデコードは不要(組み立て側の`buildRealEstateDetailPath`はエンコードして渡す)。
 *
 * 物件の取得はブラウザ側のFirebase SDK頼み(サーバー側から`uid`を特定できない)なので、
 * ここではIDを渡すだけにして`RealEstateDetailScreen`で取得する。該当が無い場合の
 * 「物件が見つかりません」もそちらが出す。
 *
 * 静的な`/real-estate/new`(B7 新規登録モード)はこの動的セグメントより優先されるため、
 * `new`というIDの物件がこの画面に来ることはない。
 */
const RealEstateDetailPage = async ({
  params,
}: RealEstatePropertyPageProps): Promise<JSX.Element> => {
  const { id } = await params;

  return <RealEstateDetailScreen propertyId={id} />;
};

export default RealEstateDetailPage;
