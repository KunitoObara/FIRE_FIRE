import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
  このファイルは `npx shadcn add pagination` の出力ではなく、**手で書いてある**。
  CLIは既存の `button.tsx` の上書きを求めたうえ(DESIGN.md 2章のとおり寸法を取り直してあり、
  上書きすると消える)、依存として無関係な `cn` パッケージを `package.json` に足そうとする。
  このプロジェクトの `cn` は `@/lib/utils` にあり、そちらは要らない。

  上流との差は次の3点で、いずれも意図的なもの。

  1. **リンクは `next/link` を使う。** 内部遷移に素の `<a>` を使わないため
     (CODING_STANDARDS.md 2章)。上流は `<a>` を出力する
  2. **`href` を省くと押せない状態になる。** 先頭ページで「前へ」、末尾ページで「次へ」を
     出す先が無い。リンクごと消すとボタンの位置が左右にずれて、押し間違いを誘う
  3. **寸法は `sm`(32px)に揃える。** 並ぶのが表のフッター(`text-xs`)で、既定の40pxだと
     件数表示・表示件数セレクタと高さが合わない
*/

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      // ページ送りは補助的な操作なので、スクリーンリーダーには役割が伝わる名前を持たせる
      aria-label="ページ送り"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  /** 現在表示中のページか。`aria-current` と塗りの両方に効かせる */
  isActive?: boolean;
  /**
   * 遷移先。**省略すると押せない状態で描画する**(先頭ページの「前へ」等)。
   * `<a>` は `disabled` を持たないので、リンクではない要素に置き換えて `aria-disabled` を付ける
   */
  href?: string;
} & Pick<VariantProps<typeof buttonVariants>, "size"> &
  Omit<React.ComponentProps<typeof Link>, "href">;

function PaginationLink({
  className,
  isActive = false,
  size = "icon-sm",
  href,
  ...props
}: PaginationLinkProps) {
  const classNames = cn(
    buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
    // 現在ページは押せるままにするが、どこにいるかが分かるように塗りを変える
    isActive ? "border-border bg-muted text-foreground" : "text-muted-foreground",
    className,
  );

  if (href === undefined) {
    return (
      <span
        aria-disabled
        data-slot="pagination-link"
        className={cn(classNames, "pointer-events-none opacity-50")}
        {...(props as React.ComponentProps<"span">)}
      />
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      href={href}
      className={classNames}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="前のページ"
      size={size}
      className={cn("gap-1 px-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">前へ</span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="次のページ"
      size={size}
      className={cn("gap-1 px-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">次へ</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-8 items-center justify-center text-muted-foreground", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">省略されたページ</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
