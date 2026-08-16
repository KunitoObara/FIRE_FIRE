"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_TRANSACTION_ACCOUNTS_VALUE,
  ALL_TRANSACTION_CATEGORIES_VALUE,
  ALL_TRANSACTION_CATEGORY_MINORS_VALUE,
  TRANSACTIONS_CSV_IMPORT_LINK,
  TRANSACTION_PERIODS,
} from "@/constants/transactions";
import {
  buildTransactionSelectOptions,
  buildTransactionsHref,
  resolveCategoryMinorOptions,
} from "@/lib/transactions/filters";

import type { ChangeEvent, FormEvent, JSX } from "react";

const PERIOD_SELECT_ID = "transactions-period";
const CATEGORY_SELECT_ID = "transactions-category";
const CATEGORY_MINOR_SELECT_ID = "transactions-category-minor";
const ACCOUNT_SELECT_ID = "transactions-account";
const KEYWORD_INPUT_ID = "transactions-keyword";

/**
 * 費目・中項目・口座のセレクタ(このフォーム専用)。
 *
 * 3つとも「すべて + 取引から抽出した選択肢」という同じ形で、違うのはラベルと幅だけになる。
 * 選択中の値がその期間に無い場合は`buildTransactionSelectOptions`が但し書き付きの選択肢を
 * 足してくるので、ここはそれをそのまま並べる。
 */
const TransactionFilterSelect = ({
  id,
  label,
  allValue,
  options,
  value,
  widthClassName,
  onChange,
}: TransactionFilterSelectProps): JSX.Element => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}
    </Label>
    <Select
      value={value || allValue}
      onValueChange={(next) => onChange(next === allValue ? "" : next)}
    >
      <SelectTrigger id={id} size="sm" className={widthClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>すべて</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/**
 * B3の絞り込み条件(期間・費目(大項目/中項目)・口座・キーワード)。
 *
 * B1の分類軸・期間セレクタと異なり即時反映にはせず、「絞り込む」ボタンで確定させる
 * (HTMLモック・docs/screen-requirements-dashboard.md B3の構成に合わせる)。複数条件を
 * 一度に変えられるのに1操作ごとにURLへ反映すると、変更のたびに一覧が再計算されて煩雑なため。
 * 並び替え・ページングはこのフォームと独立してURLへ即時反映する(TransactionsTable側)。
 *
 * 編集中のドラフト値は`useState(filters.xxx)`で初期値としてのみ受け取り、以後は自分の
 * `handleSubmit`でしか更新しない。ブラウザの戻る/進む等、フォームの送信を経由せず`filters`
 * (URL)が変わった場合は、呼び出し側(`page.tsx`)が`key`にfiltersの絞り込み条件を含めて
 * TransactionsFilterBarごと再マウントさせることでドラフトをURLの内容に同期させる
 * (`useEffect`でstateを追従させると`react-hooks/set-state-in-effect`に抵触するため、
 * Reactが推奨する「keyでリセットする」方式を採る)。
 */
export const TransactionsFilterBar = ({
  categories,
  categoryMinorsByMajor,
  accounts,
  filters,
}: TransactionsFilterBarProps): JSX.Element => {
  const router = useRouter();
  const [periodId, setPeriodId] = useState<TransactionPeriodId>(filters.periodId);
  const [category, setCategory] = useState(filters.category);
  const [categoryMinor, setCategoryMinor] = useState(filters.categoryMinor);
  const [account, setAccount] = useState(filters.account);
  const [keyword, setKeyword] = useState(filters.keyword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    router.push(
      buildTransactionsHref({
        ...filters,
        periodId,
        category,
        categoryMinor,
        account,
        keyword,
        page: 1,
      }),
    );
  };

  /**
   * 大項目を変えたら中項目は「すべて」に戻す。
   *
   * 中項目の選択肢は大項目の配下に絞られるので、そのまま残すと選ばれている中項目が選択肢に
   * 無い状態になり、送信すれば必ず0件になる。**期間の切り替えで選択が消えるのを嫌うのとは
   * 別の話** — あちらはユーザーが触っていない値が黙って変わることで、こちらはユーザー自身が
   * いま費目を選び直している最中の連動になる。
   */
  const handleCategoryChange = (value: string): void => {
    setCategory(value);
    setCategoryMinor("");
  };

  const handleKeywordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setKeyword(event.target.value);
  };

  const categoryOptions = buildTransactionSelectOptions(categories, category);
  const categoryMinorOptions = buildTransactionSelectOptions(
    resolveCategoryMinorOptions(categoryMinorsByMajor, category),
    categoryMinor,
  );
  const accountOptions = buildTransactionSelectOptions(accounts, account);

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={PERIOD_SELECT_ID} className="text-xs text-muted-foreground">
              期間
            </Label>
            <Select
              value={periodId}
              onValueChange={(value) => setPeriodId(value as TransactionPeriodId)}
            >
              <SelectTrigger id={PERIOD_SELECT_ID} size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_PERIODS.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TransactionFilterSelect
            id={CATEGORY_SELECT_ID}
            label="費目(大項目)"
            allValue={ALL_TRANSACTION_CATEGORIES_VALUE}
            options={categoryOptions}
            value={category}
            widthClassName="w-36"
            onChange={handleCategoryChange}
          />

          <TransactionFilterSelect
            id={CATEGORY_MINOR_SELECT_ID}
            label="費目(中項目)"
            allValue={ALL_TRANSACTION_CATEGORY_MINORS_VALUE}
            options={categoryMinorOptions}
            value={categoryMinor}
            widthClassName="w-36"
            onChange={setCategoryMinor}
          />

          <TransactionFilterSelect
            id={ACCOUNT_SELECT_ID}
            label="口座"
            allValue={ALL_TRANSACTION_ACCOUNTS_VALUE}
            options={accountOptions}
            value={account}
            widthClassName="w-40"
            onChange={setAccount}
          />

          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={KEYWORD_INPUT_ID} className="text-xs text-muted-foreground">
              キーワード検索
            </Label>
            <Input
              id={KEYWORD_INPUT_ID}
              value={keyword}
              onChange={handleKeywordChange}
              placeholder="摘要を検索"
            />
          </div>

          <Button type="submit" variant="outline" size="sm">
            絞り込む
          </Button>

          <Button asChild size="sm" className="ml-auto">
            <Link href={TRANSACTIONS_CSV_IMPORT_LINK.href}>
              {TRANSACTIONS_CSV_IMPORT_LINK.label}
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
