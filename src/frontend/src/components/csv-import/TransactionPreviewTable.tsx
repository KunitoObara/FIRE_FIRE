import { formatSignedJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * 入出金明細の取込対象サンプル行(docs/screen-requirements-dashboard.md B2「入出金明細タブ」)。
 *
 * 列は日付・内容・金額・口座・大項目/中項目。資産残高推移のプレビューが資産種別を横に並べる
 * のとは別の表になるため、`CsvPreviewTable`とは共有せず分けてある。
 *
 * 金額は符号をそのまま出す(収入がプラス、支出がマイナス)。B1の収支サマリが支出を絶対値で
 * 見せるのとは扱いが違うが、ここはCSVの1行ずつを取込前に突き合わせる場所なので、元の値と
 * 同じ形で読めるほうがよい(B3の一覧と同じ考え方)。
 */
export const TransactionPreviewTable = ({ rows }: TransactionPreviewTableProps): JSX.Element => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted">
          <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
            日付
          </th>
          <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
            内容
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
            金額
          </th>
          <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
            口座
          </th>
          <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
            大項目/中項目
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t">
            <th
              scope="row"
              className="px-3 py-2 text-left font-normal whitespace-nowrap tabular-nums"
            >
              {row.date}
            </th>
            <td className="px-3 py-2 whitespace-nowrap">{row.content}</td>
            <td
              className={
                row.amount < 0
                  ? "px-3 py-2 text-right whitespace-nowrap text-destructive tabular-nums"
                  : "px-3 py-2 text-right whitespace-nowrap text-success tabular-nums"
              }
            >
              {formatSignedJpy(row.amount)}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{row.account}</td>
            {/*
              中項目が空の取引は大項目だけを出す。マネーフォワードが空で返しているものに
              「(未分類)」のような名前をアプリ側で与えない
              (docs/transaction-import-requirements.md 6章)
            */}
            <td className="px-3 py-2 whitespace-nowrap">
              {row.categoryMinor
                ? `${row.categoryMajor} / ${row.categoryMinor}`
                : row.categoryMajor}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
