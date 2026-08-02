import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REAL_ESTATE_NOT_FOUND } from "@/constants/real-estate";

import type { JSX } from "react";

/**
 * 指定された物件が見つからないときの表示(B6 詳細・B7 編集モード)。
 *
 * 削除済みの物件をブックマークや履歴から開いた場合に出る。要件どおり遷移はせず、
 * 行き止まりにしないよう一覧(B5)への導線を添える
 * (docs/screen-requirements-real-estate.md B6の遷移条件)。
 *
 * Next.jsの`not-found.tsx`ではなく通常のコンポーネントにしているのは、物件の取得が
 * ブラウザ側(Client Component)で走るためである。`notFound()`はサーバー側のレンダリングを
 * 打ち切るための関数で、取得結果が出るのがクライアントの描画後になるこの画面では使えない。
 */
export const RealEstateNotFoundCard = (): JSX.Element => (
  <Card className="max-w-2xl">
    <CardHeader>
      <CardTitle className="text-base">{REAL_ESTATE_NOT_FOUND.title}</CardTitle>
      <CardDescription>{REAL_ESTATE_NOT_FOUND.message}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild variant="outline" size="sm">
        <Link href={REAL_ESTATE_NOT_FOUND.action.href}>{REAL_ESTATE_NOT_FOUND.action.label}</Link>
      </Button>
    </CardContent>
  </Card>
);
