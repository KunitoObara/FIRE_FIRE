import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { JSX } from "react";

/**
 * 未実装画面のプレースホルダ。
 *
 * B1のダッシュボードは「CSVを取り込む」「詳細を見る」「目標を設定する」やサイドバーから
 * 他の主要画面へ遷移できることが要件(docs/screen-requirements-dashboard.md B1の遷移条件)
 * なので、遷移先が404にならないよう各画面のカードだけ先に置いておく。
 *
 * 各画面のカードを実装するときは、対応する`page.tsx`の中身を差し替えてこれを外す。
 */
export const UnimplementedScreen = ({
  screenId,
  screenName,
  purpose,
}: UnimplementedScreenProps): JSX.Element => (
  <Card className="max-w-2xl">
    <CardHeader>
      <CardTitle className="text-base">
        {screenId} {screenName}
      </CardTitle>
      <CardDescription>{purpose}</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        この画面はまだ実装されていません。サイドバーから他の画面へ移動できます。
      </p>
    </CardContent>
  </Card>
);
