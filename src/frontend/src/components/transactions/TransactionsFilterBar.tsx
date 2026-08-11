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
  TRANSACTIONS_CSV_IMPORT_LINK,
  TRANSACTION_PERIODS,
} from "@/constants/transactions";
import { buildTransactionsHref } from "@/lib/transactions/filters";

import type { ChangeEvent, FormEvent, JSX } from "react";

const PERIOD_SELECT_ID = "transactions-period";
const CATEGORY_SELECT_ID = "transactions-category";
const ACCOUNT_SELECT_ID = "transactions-account";
const KEYWORD_INPUT_ID = "transactions-keyword";

/**
 * B3の絞り込み条件(期間・費目・口座・キーワード)。
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
  accounts,
  filters,
}: TransactionsFilterBarProps): JSX.Element => {
  const router = useRouter();
  const [periodId, setPeriodId] = useState<TransactionPeriodId>(filters.periodId);
  const [category, setCategory] = useState(filters.category);
  const [account, setAccount] = useState(filters.account);
  const [keyword, setKeyword] = useState(filters.keyword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    router.push(
      buildTransactionsHref({ ...filters, periodId, category, account, keyword, page: 1 }),
    );
  };

  const handleKeywordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setKeyword(event.target.value);
  };

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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={CATEGORY_SELECT_ID} className="text-xs text-muted-foreground">
              費目
            </Label>
            <Select
              value={category || ALL_TRANSACTION_CATEGORIES_VALUE}
              onValueChange={(value) =>
                setCategory(value === ALL_TRANSACTION_CATEGORIES_VALUE ? "" : value)
              }
            >
              <SelectTrigger id={CATEGORY_SELECT_ID} size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TRANSACTION_CATEGORIES_VALUE}>すべて</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ACCOUNT_SELECT_ID} className="text-xs text-muted-foreground">
              口座
            </Label>
            <Select
              value={account || ALL_TRANSACTION_ACCOUNTS_VALUE}
              onValueChange={(value) =>
                setAccount(value === ALL_TRANSACTION_ACCOUNTS_VALUE ? "" : value)
              }
            >
              <SelectTrigger id={ACCOUNT_SELECT_ID} size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TRANSACTION_ACCOUNTS_VALUE}>すべて</SelectItem>
                {accounts.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
