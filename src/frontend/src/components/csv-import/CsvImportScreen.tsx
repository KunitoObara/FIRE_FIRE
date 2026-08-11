"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetBalanceImportPanel } from "@/components/csv-import/AssetBalanceImportPanel";
import { ImportHistoryCard } from "@/components/csv-import/ImportHistoryCard";
import { TransactionImportPanel } from "@/components/csv-import/TransactionImportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CSV_IMPORT_TYPES,
  DEFAULT_CSV_IMPORT_TYPE_ID,
  IMPORT_HISTORY_QUERY_KEY,
} from "@/constants/csv-import";
import { DASHBOARD_DATA_QUERY_KEY } from "@/constants/dashboard";
import { TRANSACTIONS_DATA_QUERY_KEY } from "@/constants/transactions";
import { fetchImportHistory } from "@/lib/csv-import/asset-balance-repository";

import type { JSX } from "react";

/**
 * B2 CSV取込画面の本体(docs/screen-requirements-dashboard.md B2)。
 *
 * 取込種別タブ・直近の取込履歴・プレビューエリアをまとめる。ファイルの読み込みも
 * Firestoreへの書き込みもブラウザ側で行うため、画面全体をClient Componentにしている
 * (認証をブラウザのFirebase SDKが持っており、サーバー側から`uid`を特定できない)。
 *
 * タブは`forceMount`で常に組み立てておき、切り替えても選択中のファイルやプレビューを
 * 捨てない(DESIGN.md 6章「タブ切替で入力値を保持する」)。
 */
export const CsvImportScreen = (): JSX.Element => {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: IMPORT_HISTORY_QUERY_KEY,
    queryFn: fetchImportHistory,
  });

  /**
   * 取込完了(および途中まで反映されての失敗)後の後始末。
   *
   * 取り込んだ内容は他の画面の表示そのものなので、戻ったときに古い集計を見せないよう
   * キャッシュを落とす。落とす先は取込種別で変わる。
   *
   * - 資産残高推移 → B1(資産推移グラフ・分類別内訳)
   * - 入出金明細 → B1(収支サマリ)とB3(収支明細一覧)
   */
  const handleImported = (typeId: CsvImportTypeId): void => {
    void history.refetch();
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_QUERY_KEY });

    if (typeId === "transaction") {
      void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_DATA_QUERY_KEY });
    }
  };

  // 取得できない場合(未ログイン・権限なし)は履歴を空のまま見せる。取込そのものは
  // 実行時に理由付きで失敗するので、ここで重ねてエラーを出しても増える情報が無い
  const entries = history.data?.ok === true ? history.data.entries : [];

  return (
    <>
      <Tabs defaultValue={DEFAULT_CSV_IMPORT_TYPE_ID} className="gap-6">
        <TabsList aria-label="取込種別">
          {CSV_IMPORT_TYPES.map((type) => (
            <TabsTrigger key={type.id} value={type.id}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CSV_IMPORT_TYPES.map((type) => (
          <TabsContent
            key={type.id}
            value={type.id}
            forceMount
            className="data-[state=inactive]:hidden"
          >
            {/*
              `forceMount`を付けると選択されていないタブも組み立てられたままになる代わりに、
              Radixは`hidden`属性を付けなくなる。非表示は`data-state`から自分で当てる。
              レイアウト用のクラスを内側のdivに置いているのも同じ理由で、ここに`flex`を
              指定すると`display`が上書きされて隠れなくなる
            */}
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">{type.description}</p>

              {type.id === "transaction" ? (
                <TransactionImportPanel onImported={() => handleImported(type.id)} />
              ) : (
                <AssetBalanceImportPanel onImported={() => handleImported(type.id)} />
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <ImportHistoryCard entries={entries} loading={history.isPending} />
    </>
  );
};
