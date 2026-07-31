import { UnimplementedScreen } from "@/components/layout/UnimplementedScreen";

import type { JSX } from "react";

const TransactionsPage = (): JSX.Element => (
  <UnimplementedScreen
    screenId="B3"
    screenName="収支明細一覧画面"
    purpose="入出金明細CSVから取り込んだ個々の取引データを一覧・検索する"
  />
);

export default TransactionsPage;
