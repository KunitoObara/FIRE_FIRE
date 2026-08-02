import Link from "next/link";

import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { RealEstatePropertyList } from "@/components/real-estate/RealEstatePropertyList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NO_REAL_ESTATE_EMPTY_STATE,
  REAL_ESTATE_LIST_DESCRIPTION,
  REAL_ESTATE_NEW_LINK,
  SAMPLE_REAL_ESTATE_DATA_NOTICE,
  USE_SAMPLE_REAL_ESTATE_DATA,
} from "@/constants/real-estate";
import { getRealEstateProperties } from "@/lib/real-estate/real-estate-data";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "不動産一覧 | FIRE-FIRE",
};

/**
 * B5 不動産一覧画面(docs/screen-requirements-real-estate.md B5)。
 *
 * 入力項目を持たない参照専用の画面で、操作は「新規登録」ボタン(B7)と物件行のクリック(B6)
 * だけなので、Server Componentのまま組む。
 *
 * 「新規登録」ボタンはモックでは共通ヘッダーに置かれているが、`AppHeader`は全画面共通で
 * 画面ごとのアクションを差し込む口を持たないため、B4と同じく本文の先頭に置く。
 *
 * 表示データはまだFirestoreに繋がっておらず、`getRealEstateProperties`がサンプルデータを返す
 * (`src/constants/real-estate.ts`の`USE_SAMPLE_REAL_ESTATE_DATA`)。物件を登録する画面(B7)が
 * まだ無いため、実データへの繋ぎ込みは別カードで行う。
 */
const RealEstatePage = (): JSX.Element => {
  const properties = getRealEstateProperties();

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{REAL_ESTATE_LIST_DESCRIPTION}</p>
        <Button asChild size="sm" className="shrink-0">
          <Link href={REAL_ESTATE_NEW_LINK.href}>{REAL_ESTATE_NEW_LINK.label}</Link>
        </Button>
      </div>

      {USE_SAMPLE_REAL_ESTATE_DATA ? (
        <p className="text-xs text-muted-foreground">{SAMPLE_REAL_ESTATE_DATA_NOTICE}</p>
      ) : null}

      {properties.length === 0 ? (
        <Card>
          <CardContent>
            <DashboardEmptyState {...NO_REAL_ESTATE_EMPTY_STATE} />
          </CardContent>
        </Card>
      ) : (
        <RealEstatePropertyList properties={properties} />
      )}
    </div>
  );
};

export default RealEstatePage;
