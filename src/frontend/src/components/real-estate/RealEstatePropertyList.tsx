import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import {
  REAL_ESTATE_LOAN_BALANCE_LABEL,
  REAL_ESTATE_MARKET_VALUE_LABEL,
} from "@/constants/real-estate";
import { buildRealEstateDetailPath } from "@/constants/routes";
import { formatJpy } from "@/lib/format/currency";
import { toShortLocation } from "@/lib/real-estate/location";

import type { JSX } from "react";

/**
 * 物件1件の行。行全体がB6 不動産詳細画面へのリンクになる
 * (要件の「物件行のクリック」がそのまま遷移になるようにする)。
 *
 * 金額の見出し(時価・ローン残高)を値の上に添えるのは、スマートフォン幅では表のヘッダ行を
 * 置けず、2つの金額のどちらがどちらか分からなくなるため。
 */
const RealEstatePropertyRow = ({ property }: RealEstatePropertyRowProps): JSX.Element => (
  <li>
    <Link
      href={buildRealEstateDetailPath(property.id)}
      className="flex items-center gap-4 px-4 py-4 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{property.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {toShortLocation(property.location)}
          </p>
        </div>

        {/*
          利ざや(時価-ローン残高)はここに出さない。一覧には出さずB6でのみ表示するのが
          要件(docs/screen-requirements-real-estate.md B5の遷移条件)。
        */}
        <div className="flex shrink-0 gap-6 tabular-nums">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{REAL_ESTATE_MARKET_VALUE_LABEL}</p>
            <p className="text-sm font-medium">{formatJpy(property.marketValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{REAL_ESTATE_LOAN_BALANCE_LABEL}</p>
            <p className="text-sm font-medium">{formatJpy(property.loanBalance)}</p>
          </div>
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  </li>
);

/**
 * B5 不動産一覧画面の物件一覧(docs/screen-requirements-real-estate.md B5)。
 *
 * 参照専用で、編集・削除の導線は持たない(編集はB6経由でB7へ入る)。行数が少なく列の
 * 並び替えも要件に無いため、B3のようなテーブルではなくリストで組む。
 */
export const RealEstatePropertyList = ({
  properties,
}: RealEstatePropertyListProps): JSX.Element => (
  <Card className="py-0">
    <ul className="divide-y">
      {properties.map((property) => (
        <RealEstatePropertyRow key={property.id} property={property} />
      ))}
    </ul>
  </Card>
);
