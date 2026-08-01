"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import type { JSX } from "react";

/**
 * TanStack Queryのプロバイダ(src/frontend/docs/TECH_STACK.md 3章)。
 *
 * Firestoreはブラウザ側のFirebase SDKからしか引けないため、サーバー由来のデータでも
 * 取得はクライアントで起きる。その取得状態(ローディング・再検証・キャッシュ)を画面ごとの
 * `useEffect`で組まず、ここに集約する。
 *
 * `QueryClient`は`useState`の初期化関数で1度だけ作る。レンダーのたびに作り直すと
 * キャッシュが毎回捨てられ、リクエストが重複する。
 */
export const QueryProvider = ({ children }: QueryProviderProps): JSX.Element => {
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
