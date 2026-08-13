"use client";

import { format, parseISO } from "date-fns";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeleteRealEstateDialog } from "@/components/real-estate/DeleteRealEstateDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REAL_ESTATE_ACQUIRED_ON_EMPTY_LABEL,
  REAL_ESTATE_ACQUIRED_ON_LABEL,
  REAL_ESTATE_BACK_TO_LIST_LINK,
  REAL_ESTATE_BASIC_INFO_SECTION_TITLE,
  REAL_ESTATE_DELETE_LABEL,
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
const RealEstateValuationCard = ({ property }: RealEstateValuationCardProps): JSX.Element => {
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
            {/*
              ラベルには正負の色を付けない(賃貸収支カードと揃える)。値に必ず符号が付くので
              色は補助でしかなく、ラベルまで色を変えると背景の色と合わせて主張が過剰になる。
            */}
            <dt className="text-xs text-muted-foreground">
              {REAL_ESTATE_SPREAD_LABEL}
              <span className="ml-1">({REAL_ESTATE_SPREAD_DESCRIPTION})</span>
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
const RealEstateBasicInfoCard = ({ property }: RealEstateValuationCardProps): JSX.Element => (
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
        {/*
          取得年月は資産推移グラフが物件を積み始める起点(B1「不動産を含む分類軸の集計」)。
          入力欄はB7にしか無いので、値が入っているかを参照側でも確かめられるようにする。
          未入力でも行ごと消さない — 項目名と値が対になるリストでは、行が無いと項目そのものが
          存在しないように見えるため。
        */}
        <dt className="text-muted-foreground">{REAL_ESTATE_ACQUIRED_ON_LABEL}</dt>
        <dd className="tabular-nums">
          {property.acquiredOn === null
            ? REAL_ESTATE_ACQUIRED_ON_EMPTY_LABEL
            : format(parseISO(`${property.acquiredOn}-01`), "yyyy年M月")}
        </dd>
        <dt className="text-muted-foreground">{REAL_ESTATE_UPDATED_AT_LABEL}</dt>
        <dd className="tabular-nums">{format(parseISO(property.updatedAt), "yyyy/MM/dd")}</dd>
      </dl>
    </CardContent>
  </Card>
);

/**
 * 物件名の直下に添える1行。
 *
 * 収益物件かどうかは賃貸収支カードの有無でも分かるが、それはスクロールしないと見えない
 * ことがあるため、ここでも示す。所在地は任意入力(B7)で空のことがあるため、区切りの
 * 「・」は両方が揃ったときにだけ入れる。
 */
const buildPropertySubtitle = (property: RealEstateProperty): string =>
  [
    toShortLocation(property.location),
    property.rental === undefined ? "" : REAL_ESTATE_RENTAL_PROPERTY_LABEL,
  ]
    .filter((part) => part.length > 0)
    .join("・");

/**
 * B6 不動産詳細画面の本体(docs/screen-requirements-real-estate.md B6)。
 *
 * 参照専用の表示に、操作は「編集」(B7 編集モード)・「削除」・「一覧に戻る」(B5)の3つ。
 * **削除の確認ダイアログの開閉を持つためClient Componentにしている**(B6-1)。それまでは
 * 入力も状態も無くServer Componentで組めていた。
 *
 * 削除そのもの(Firestoreへの書き込み・成功後の遷移・トースト)は呼び出し側が持つ。
 * 遷移先のB5と一覧のキャッシュはこのコンポーネントの外の関心事であるため。
 */
export const RealEstateDetail = ({
  property,
  affectedAxisNames,
  onDelete,
}: RealEstateDetailProps): JSX.Element => {
  const [deleting, setDeleting] = useState(false);

  return (
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
          <p className="text-sm text-muted-foreground">{buildPropertySubtitle(property)}</p>
        </div>
        {/*
        「削除」は「編集」の隣に置く(B5の一覧には置かない)。一覧の行は全体がこの画面への
        リンクで、行の中に破壊的な操作を混ぜると誤操作で消えるため
      */}
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={buildRealEstateEditPath(property.id)}>{REAL_ESTATE_EDIT_LABEL}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            {REAL_ESTATE_DELETE_LABEL}
          </Button>
        </div>
      </div>

      <RealEstateValuationCard property={property} />
      {property.rental ? <RealEstateRentalCard rental={property.rental} /> : null}
      <RealEstateBasicInfoCard property={property} />

      <DeleteRealEstateDialog
        property={deleting ? property : null}
        affectedAxisNames={affectedAxisNames}
        onOpenChange={(open) => setDeleting(open)}
        onConfirm={onDelete}
      />
    </div>
  );
};
