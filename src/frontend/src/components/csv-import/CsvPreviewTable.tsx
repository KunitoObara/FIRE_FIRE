import { ASSET_BALANCE_DATE_COLUMN, ASSET_BALANCE_TOTAL_COLUMN } from "@/constants/csv-import";
import { formatJpy } from "@/lib/format/currency";

import type { JSX } from "react";

/**
 * 取込対象のサンプル行(B2の遷移条件「件数・期間・サンプル行」)。
 *
 * 資産種別の列は保有状況によって10列以上になるため、列を間引かずに横スクロールさせる。
 * 見慣れない列が紛れ込んでいないかを取込前に確かめられることを優先する。
 */
export const CsvPreviewTable = ({ assetTypes, rows }: CsvPreviewTableProps): JSX.Element => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted">
          <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
            {ASSET_BALANCE_DATE_COLUMN}
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
            {ASSET_BALANCE_TOTAL_COLUMN}
          </th>
          {assetTypes.map((assetType) => (
            <th
              key={assetType}
              scope="col"
              className="px-3 py-2 text-right font-medium whitespace-nowrap"
            >
              {assetType}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((row) => (
          <tr key={row.date} className="border-t">
            <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
              {row.date}
            </th>
            <td className="px-3 py-2 text-right whitespace-nowrap">{formatJpy(row.total)}</td>
            {assetTypes.map((assetType) => (
              <td key={assetType} className="px-3 py-2 text-right whitespace-nowrap">
                {formatJpy(row.byType[assetType] ?? 0)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
