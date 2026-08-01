import { format, parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CSV_IMPORT_TYPES, NO_IMPORT_HISTORY_LABEL } from "@/constants/csv-import";

import type { JSX } from "react";

/** 取込種別IDを画面の表示名にする。未知のIDはそのまま出す(履歴を欠けさせない) */
const toTypeLabel = (typeId: CsvImportTypeId): string =>
  CSV_IMPORT_TYPES.find((type) => type.id === typeId)?.label ?? typeId;

/** 取込日時。サーバー時刻が確定するまでの短い間だけ`null`になりうる */
const formatImportedAt = (importedAt: string | null): string =>
  importedAt === null ? "反映中" : format(parseISO(importedAt), "yyyy/MM/dd HH:mm");

/**
 * 直近の取込履歴(B2の表示項目)。
 *
 * 「いつ・何を・どれだけ取り込んだか」が分かれば足りる画面なので、
 * 件数と対象期間まで出して個々の取込の詳細画面は持たせない。
 */
export const ImportHistoryCard = ({ entries, loading }: CsvImportHistoryCardProps): JSX.Element => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">直近の取込履歴</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : null}

      {!loading && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NO_IMPORT_HISTORY_LABEL}</p>
      ) : null}

      {!loading && entries.length > 0 ? (
        <ul className="flex flex-col gap-3 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span>
                {toTypeLabel(entry.typeId)}CSV
                <span className="ml-2 text-xs text-muted-foreground">{entry.fileName}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatImportedAt(entry.importedAt)}・{entry.rowCount.toLocaleString("ja-JP")}件(
                {entry.periodFrom}〜{entry.periodTo})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </CardContent>
  </Card>
);
