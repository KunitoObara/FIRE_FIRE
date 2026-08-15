import type { JSX, ReactNode } from "react";

/**
 * 認証系画面(A1〜A8)共通のシェル。
 * DESIGN.md 5章のとおり、共通ヘッダー/サイドバーを持たない中央寄せ1カラムのレイアウトとする。
 *
 * 見た目はHTMLモックの `.auth-shell` / `.auth-card` に合わせている。
 *
 * - **地は `--muted`。** 白のままだと白いカードが白い背景に乗り、境界が枠線だけになる
 * - **カードの余白は32px、影は `.card` より一段強く、角丸は2px大きい。** モックは
 *   ダッシュボードの `.card`(24px / `var(--radius)`)と認証の `.auth-card`
 *   (32px / `calc(var(--radius) + 2px)`)で値を分けているが、実装はどちらも同じ `Card` で
 *   描いているため、この違いは認証シェルの側で足す
 * - **カードヘッダーは中央寄せ。** モックはA1〜A8のいずれも見出しを中央に置く
 *
 * **カードごとにクラスを足すのではなく、ここから子孫セレクタで当てている。** 認証系の
 * 9コンポーネントは合わせて22箇所で `<Card>` を描いており(状態ごとに別の `return` を持つ
 * ため。入れ子ではなく、同時に描かれるのは常に1つ)、同じ指定を22箇所へ配ると、
 * 画面や状態を1つ足したときに付け忘れる。認証シェルに属するカードの見た目は
 * シェルが決める、という形にしておく。
 */
const AuthLayout = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className="flex flex-1 items-center justify-center bg-muted px-4 py-10">
    <div className="w-full max-w-md [&_[data-slot=card-header]]:text-center [&_[data-slot=card]]:rounded-[calc(var(--radius)+2px)] [&_[data-slot=card]]:shadow-sm [&_[data-slot=card]]:[--card-spacing:--spacing(8)]">
      {children}
    </div>
  </div>
);

export default AuthLayout;
