import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
  shadcn/uiのCLIが生成した実装から、バリアントをHTMLモック(`docs/html_mock/common.css` の
  `.alert` / `.alert-error` / `.alert-success` / `.alert-info`)に合わせて取り直している。

  生成時のバリアントは `default` / `destructive` の2つで、どちらも地が `bg-card`(枠線だけで
  色を持たない)だった。モックは**淡く色を敷いた箱**を3種持ち、実装側も画面ごとに
  ばらばらの見た目で同じ役割の通知を出していたため、モックの3種に揃える。

  **これは「フォーム全体・画面全体に対する通知」のためのもので、入力欄ごとのエラーには使わない。**
  後者はモックでは `.field-error`(枠も背景も持たない赤い小さな文字)にあたり、実装でも
  素のテキストのままにする。枠付きの箱にすると、エラーが無いときに高さだけ確保している
  箇所(`GoogleSignInButton`)で空の箱が見えてしまう。

  `role` は `{...props}` が後に展開されるため呼び出し側で上書きできる。既定の `alert` は
  即座に読み上げる必要があるエラー向けで、完了通知には `role="status"` を渡す
  (使い分けは既存の各画面の判断をそのまま引き継ぐ)。
*/
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-[0.8125rem] has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        info: "border-primary/25 bg-primary/6 text-primary",
        success: "border-success/30 bg-success/8 text-success",
        error: "border-destructive/30 bg-destructive/8 text-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      /*
        生成時は `text-muted-foreground` が付いていたが外している。モックのアラートは
        箱ごと1色で、本文だけグレーに落とすと枠・見出しと色が食い違う。
      */
      className={cn(
        "text-[0.8125rem] text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-action" className={cn("absolute top-2 right-2", className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
