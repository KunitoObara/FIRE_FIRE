import { notFound } from "next/navigation";

import { RealEstateDetail } from "@/components/real-estate/RealEstateDetail";
import {
  SAMPLE_REAL_ESTATE_DATA_NOTICE,
  USE_SAMPLE_REAL_ESTATE_DATA,
} from "@/constants/real-estate";
import { getRealEstateProperty } from "@/lib/real-estate/real-estate-data";

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
 * 該当する物件が無ければ`notFound()`で404にし、同じセグメントの`not-found.tsx`に一覧への
 * 導線を出させる。削除済みの物件をブックマークから開いたときに、空の詳細画面が出るのを避ける。
 *
 * 静的な`/real-estate/new`(B7 新規登録モード)はこの動的セグメントより優先されるため、
 * `new`というIDの物件がこの画面に来ることはない。
 *
 * 表示データはまだFirestoreに繋がっておらず、B5と同じくサンプルデータを引いている
 * (`src/constants/real-estate.ts`の`USE_SAMPLE_REAL_ESTATE_DATA`)。物件を登録する画面(B7)が
 * まだ無いため、実データへの繋ぎ込みは別カードで行う。
 */
const RealEstateDetailPage = async ({
  params,
}: RealEstateDetailPageProps): Promise<JSX.Element> => {
  const { id } = await params;
  const property = getRealEstateProperty(id);

  if (property === undefined) {
    notFound();
  }

  return (
    <>
      {USE_SAMPLE_REAL_ESTATE_DATA ? (
        <p className="text-xs text-muted-foreground">{SAMPLE_REAL_ESTATE_DATA_NOTICE}</p>
      ) : null}
      <RealEstateDetail property={property} />
    </>
  );
};

export default RealEstateDetailPage;
