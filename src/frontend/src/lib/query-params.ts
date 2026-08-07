/**
 * クエリ文字列から値を1つだけ取り出す。
 *
 * Next.jsの`searchParams`は同名のキーが複数あると配列になる。メール内リンクの
 * `oobCode`のように単一の値しか想定しないものは、配列で来た時点で意図しないリンクのため
 * 先頭を採らずnullにする(欠落と同じ扱いにし、リンクを開き直してもらう)。
 */
export const firstQueryValue = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;
