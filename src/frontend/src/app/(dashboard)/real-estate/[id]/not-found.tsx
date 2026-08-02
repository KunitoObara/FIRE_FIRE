import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REAL_ESTATE_NOT_FOUND } from "@/constants/real-estate";

import type { JSX } from "react";

/**
 * B6 不動産詳細画面で物件が見つからなかったときの表示。
 *
 * `page.tsx`の`notFound()`から描画される。このセグメントに置くことで、共通の
 * ヘッダー・サイドバー((dashboard)レイアウト)の内側に出せる — アプリ全体の404画面に
 * 飛ばすと、ログイン後のシェルから外れて他画面への導線ごと失われるため。
 */
const RealEstateDetailNotFound = (): JSX.Element => (
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

export default RealEstateDetailNotFound;
