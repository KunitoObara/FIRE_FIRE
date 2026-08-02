import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REAL_ESTATE_BACK_TO_LIST_LINK,
  REAL_ESTATE_BASIC_INFO_SECTION_TITLE,
  REAL_ESTATE_EDIT_LABEL,
  REAL_ESTATE_LOAN_BALANCE_LABEL,
  REAL_ESTATE_LOCATION_LABEL,
  REAL_ESTATE_MARKET_VALUE_LABEL,
  REAL_ESTATE_NAME_LABEL,
  REAL_ESTATE_RENTAL_BALANCE_LABEL,
  REAL_ESTATE_RENTAL_EXPENSE_LABEL,
  REAL_ESTATE_RENTAL_INCOME_LABEL,
  REAL_ESTATE_RENTAL_PROPERTY_LABEL,
  REAL_ESTATE_RENTAL_SECTION_TITLE,
  REAL_ESTATE_SPREAD_DESCRIPTION,
  REAL_ESTATE_SPREAD_LABEL,
  REAL_ESTATE_UPDATED_AT_LABEL,
} from "@/constants/real-estate";
import { buildRealEstateEditPath } from "@/constants/routes";
import { formatJpy, formatSignedJpy } from "@/lib/format/currency";
import { calculateRealEstateSpread, calculateRentalBalance } from "@/lib/real-estate/calculation";
import { toShortLocation } from "@/lib/real-estate/location";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

/**
 * 金額がマイナスかどうかで文字色を切り替える。
 *
 * 色だけに意味を持たせないよう、この色を当てる金額には必ず符号を添える
 * (`formatJpy`はマイナスを`- ¥`、`formatSignedJpy`は常に符号付きで出す)。
 */
const amountToneClass = (amount: number): string =>
  amount < 0 ? "text-destructive" : "text-success";

/**
 * 時価・ローン残高・利ざやのカード。
 *
 * 利ざや(時価-ローン残高)は保存値ではなくここで計算した値を出す
 * (docs/screen-requirements-real-estate.md B6「自動計算」)。3項目を並べたうえで
 * 利ざやだけ背景を敷くのは、この画面で確認したい値がそれだからである。
 */
const RealEstateValuationCard = ({ property }: RealEstateDetailProps): JSX.Element => {
  const spread = calculateRealEstateSpread(property);

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{REAL_ESTATE_MARKET_VALUE_LABEL}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatJpy(property.marketValue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{REAL_ESTATE_LOAN_BALANCE_LABEL}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatJpy(property.loanBalance)}
            </dd>
          </div>
          <div
            className={cn(
              "rounded-md px-3 py-2",
              spread < 0 ? "bg-destructive/10" : "bg-success/10",
            )}
          >
            <dt className={cn("text-xs", amountToneClass(spread))}>
              {REAL_ESTATE_SPREAD_LABEL}
              <span className="ml-1 text-muted-foreground">({REAL_ESTATE_SPREAD_DESCRIPTION})</span>
            </dt>
            {/*
              利ざやは残高と同じ「量」なので、プラス側に`+`を付けない(`formatJpy`)。
              オーバーローンで負になったときは`- ¥`が付き、色に頼らず読み取れる。
            */}
            <dd className={cn("text-lg font-bold tabular-nums", amountToneClass(spread))}>
              {formatJpy(spread)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};

/**
 * 賃貸収支のカード。**収益物件(`rental`を持つ物件)のときだけ描画する**
 * (docs/screen-requirements-real-estate.md B6「収益物件の場合は賃貸収入/支出」)。
 */
const RealEstateRentalCard = ({ rental }: RealEstateRentalCardProps): JSX.Element => {
  const balance = calculateRentalBalance(rental);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{REAL_ESTATE_RENTAL_SECTION_TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{REAL_ESTATE_RENTAL_INCOME_LABEL}</dt>
            <dd className="font-medium tabular-nums">{formatJpy(rental.monthlyIncome)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{REAL_ESTATE_RENTAL_EXPENSE_LABEL}</dt>
            <dd className="font-medium tabular-nums">{formatJpy(rental.monthlyExpense)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{REAL_ESTATE_RENTAL_BALANCE_LABEL}</dt>
            {/* 収支は符号そのものが意味を持つ値なので、プラスでも符号を出す */}
            <dd className={cn("font-medium tabular-nums", amountToneClass(balance))}>
              {formatSignedJpy(balance)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};

/**
 * 物件基本情報のカード。
 *
 * 所在地は画面上部の見出しでは簡略表記にしているため、ここでは登録された住所をそのまま出す
 * (`toShortLocation`のコメントと対応)。
 */
const RealEstateBasicInfoCard = ({ property }: RealEstateDetailProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">{REAL_ESTATE_BASIC_INFO_SECTION_TITLE}</CardTitle>
    </CardHeader>
    <CardContent>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">{REAL_ESTATE_NAME_LABEL}</dt>
        <dd>{property.name}</dd>
        <dt className="text-muted-foreground">{REAL_ESTATE_LOCATION_LABEL}</dt>
        <dd>{property.location}</dd>
        <dt className="text-muted-foreground">{REAL_ESTATE_UPDATED_AT_LABEL}</dt>
        <dd className="tabular-nums">{format(parseISO(property.updatedAt), "yyyy/MM/dd")}</dd>
      </dl>
    </CardContent>
  </Card>
);

/**
 * B6 不動産詳細画面の本体(docs/screen-requirements-real-estate.md B6)。
 *
 * 入力項目を持たない参照専用の画面で、操作は「編集」ボタン(B7 編集モード)と
 * 「一覧に戻る」リンク(B5)だけなので、Server Componentのまま組む。
 */
export const RealEstateDetail = ({ property }: RealEstateDetailProps): JSX.Element => (
  <div className="flex max-w-3xl flex-col gap-5">
    <Link
      href={REAL_ESTATE_BACK_TO_LIST_LINK.href}
      className="inline-flex w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      {REAL_ESTATE_BACK_TO_LIST_LINK.label}
    </Link>

    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-bold">{property.name}</h2>
        <p className="text-sm text-muted-foreground">
          {toShortLocation(property.location)}
          {/*
            収益物件かどうかは賃貸収支カードの有無でも分かるが、それはスクロールしないと
            見えないことがあるため、物件名の直下でも示す。
          */}
          {property.rental === undefined ? null : `・${REAL_ESTATE_RENTAL_PROPERTY_LABEL}`}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={buildRealEstateEditPath(property.id)}>{REAL_ESTATE_EDIT_LABEL}</Link>
      </Button>
    </div>

    <RealEstateValuationCard property={property} />
    {property.rental === undefined ? null : <RealEstateRentalCard rental={property.rental} />}
    <RealEstateBasicInfoCard property={property} />
  </div>
);
