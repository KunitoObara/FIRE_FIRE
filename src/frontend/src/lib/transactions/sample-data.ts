import { addDays, format, startOfMonth, subMonths } from "date-fns";

/**
 * B3の見た目を確認するためのサンプルデータ。
 *
 * 入出金明細CSVの取込(B2)がまだ無く、Firestoreに実データが存在しないための一時的な置き換えで
 * ある(`src/lib/dashboard/sample-data.ts`と同じ位置付け)。データの繋ぎ込み時にこのファイルごと
 * 削除し、`src/lib/transactions/transactions-data.ts`の取得元を差し替える。
 *
 * 基準日を引数で受け、同じ基準日なら常に同じ値を返す(乱数を使わない。理由はdashboard側と同じで、
 * 描画のたびに数値が変わるとサーバーとクライアントで表示がずれるため)。
 */

/** サンプルを生成する月数。直近1年強をカバーし、「今年」「全期間」の絞り込みも確認できるようにする */
const SAMPLE_MONTHS = 14;

type ExpenseTemplate = {
  category: string;
  account: string;
  description: string;
  /** 支出額(正の数)。取引データにはこれにマイナスを付けて格納する */
  baseAmount: number;
  /** 1か月あたりの発生回数 */
  timesPerMonth: number;
};

const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    category: "食費",
    account: "楽天カード",
    description: "イオン",
    baseAmount: 3_280,
    timesPerMonth: 4,
  },
  {
    category: "食費",
    account: "楽天カード",
    description: "スーパーマルエツ",
    baseAmount: 2_150,
    timesPerMonth: 4,
  },
  { category: "食費", account: "現金", description: "ランチ", baseAmount: 980, timesPerMonth: 6 },
  {
    category: "住居費",
    account: "普通預金(三井住友)",
    description: "家賃引き落とし",
    baseAmount: 98_000,
    timesPerMonth: 1,
  },
  {
    category: "水道・光熱費",
    account: "普通預金(三井住友)",
    description: "電気料金",
    baseAmount: 9_800,
    timesPerMonth: 1,
  },
  {
    category: "水道・光熱費",
    account: "普通預金(三井住友)",
    description: "ガス料金",
    baseAmount: 6_400,
    timesPerMonth: 1,
  },
  {
    category: "通信費",
    account: "楽天カード",
    description: "携帯電話料金",
    baseAmount: 8_200,
    timesPerMonth: 1,
  },
  {
    category: "交通費",
    account: "楽天カード",
    description: "JR東日本",
    baseAmount: 1_200,
    timesPerMonth: 3,
  },
  {
    category: "交通費",
    account: "楽天カード",
    description: "東京メトロ",
    baseAmount: 840,
    timesPerMonth: 3,
  },
  {
    category: "娯楽費",
    account: "楽天カード",
    description: "Netflix",
    baseAmount: 1_490,
    timesPerMonth: 1,
  },
  {
    category: "日用品",
    account: "楽天カード",
    description: "ドラッグストア",
    baseAmount: 1_850,
    timesPerMonth: 2,
  },
];

const INCOME_TEMPLATE = {
  category: "給与",
  account: "普通預金(三井住友)",
  description: "給与振込",
  baseAmount: 420_000,
};

/**
 * テンプレートと発生回数から、月内の発生日を決める。
 *
 * 乱数は使わず、テンプレートの登場順・月インデックス・発生回数インデックスから決めることで、
 * 同じ組み合わせなら常に同じ値になるようにしている(`src/lib/dashboard/sample-data.ts`の
 * `buildNetWorthSeries`と同じ考え方)。1〜26日に収め、月末日数の差(28〜31日)を気にしなくて
 * 済むようにする。
 */
const buildOccurrenceDay = (
  templateIndex: number,
  monthIndex: number,
  occurrenceIndex: number,
): number => {
  const seed = templateIndex * 5 + monthIndex * 3 + occurrenceIndex * 11;
  return (seed % 26) + 1;
};

/** 金額に±10%程度の緩やかな揺れを加える。実データらしく見せるためだけのもの */
const buildAmountVariation = (
  templateIndex: number,
  monthIndex: number,
  occurrenceIndex: number,
): number => {
  const seed = templateIndex + monthIndex + occurrenceIndex;
  return 1 + 0.1 * Math.sin(seed);
};

const buildMonthTransactions = (
  monthIndex: number,
  monthStart: Date,
  nowStr: string,
): Transaction[] => {
  const incomeDateStr = format(addDays(monthStart, 17), "yyyy-MM-dd");

  const income: Transaction[] =
    incomeDateStr <= nowStr
      ? [
          {
            id: `income-${monthIndex}`,
            date: incomeDateStr,
            category: INCOME_TEMPLATE.category,
            account: INCOME_TEMPLATE.account,
            amount: INCOME_TEMPLATE.baseAmount,
            description: INCOME_TEMPLATE.description,
          },
        ]
      : [];

  const expenses = EXPENSE_TEMPLATES.flatMap((template, templateIndex) =>
    Array.from({ length: template.timesPerMonth }, (_, occurrenceIndex) => {
      const day = buildOccurrenceDay(templateIndex, monthIndex, occurrenceIndex);
      const dateStr = format(addDays(monthStart, day - 1), "yyyy-MM-dd");
      const variation = buildAmountVariation(templateIndex, monthIndex, occurrenceIndex);
      const amount = -Math.round((template.baseAmount * variation) / 10) * 10;

      return {
        id: `expense-${monthIndex}-${templateIndex}-${occurrenceIndex}`,
        date: dateStr,
        category: template.category,
        account: template.account,
        amount,
        description: template.description,
      };
    }).filter((transaction) => transaction.date <= nowStr),
  );

  return [...income, ...expenses];
};

/** B3に流し込むサンプルの取引一覧を生成する */
export const createSampleTransactions = (now: Date): Transaction[] => {
  const latestMonth = startOfMonth(now);
  const nowStr = format(now, "yyyy-MM-dd");

  return Array.from({ length: SAMPLE_MONTHS }, (_, monthIndex) =>
    buildMonthTransactions(monthIndex, subMonths(latestMonth, monthIndex), nowStr),
  ).flat();
};

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ja"));

/** B3に流し込むサンプルデータ一式(取引一覧 + 費目・口座の選択肢)を組み立てる */
export const createSampleTransactionsData = (now: Date): TransactionsData => {
  const transactions = createSampleTransactions(now);

  return {
    transactions,
    categories: uniqueSorted(transactions.map((transaction) => transaction.category)),
    accounts: uniqueSorted(transactions.map((transaction) => transaction.account)),
  };
};
