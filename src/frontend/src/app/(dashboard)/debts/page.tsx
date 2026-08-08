import { DebtInputScreen } from "@/components/debts/DebtInputScreen";

import type { Metadata } from "next";
import type { JSX } from "react";

export const metadata: Metadata = {
  title: "負債入力 | FIRE-FIRE",
};

/**
 * B11 負債入力画面(docs/screen-requirements-dashboard.md B11)。
 *
 * 住宅ローン・カードローン・奨学金などの負債を手動で登録・編集・削除する。
 * マネーフォワードは負債をCSVに出力しないため(要件定義書 4.8)、この画面が唯一の入り口になる。
 */
const DebtsPage = (): JSX.Element => <DebtInputScreen />;

export default DebtsPage;
