import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert } from "@/components/ui/alert";

/**
 * `ui/**` は原則テストを持たない(CLIが生成するベンダーコードのため)が、`Alert` の
 * **`role` を呼び出し側で差し替えられること**だけは検証しておく。
 *
 * `Alert` は既定で `role="alert"` を持つ。これは即座に読み上げてほしいエラー向けの既定で、
 * 完了通知には `role="status"`、単なる手順の案内には role 無しが正しい。この使い分けは
 * 各画面が元々持っていた判断で、アラートの箱に置き換えるときに壊してはいけない。
 *
 * 実現しているのは「`role="alert"` より後に `{...props}` を展開する」という並びだけなので、
 * 属性の順序を入れ替えると**何のエラーも出ないまま**全ての通知が `role="alert"` になる。
 * 手順の案内が割り込みで読み上げられるようになるが、画面を見ているだけでは気付けない。
 */
describe("Alert", () => {
  it("既定では role=alert を持つ", () => {
    render(<Alert variant="error">エラーです</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent("エラーです");
  });

  it("role=status に差し替えられる(完了通知)", () => {
    render(
      <Alert variant="success" role="status">
        送信しました
      </Alert>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("送信しました");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("role={undefined} で role を持たなくなる(手順の案内)", () => {
    const { container } = render(
      <Alert variant="info" role={undefined}>
        リンクをクリックしてください
      </Alert>,
    );

    expect(container.querySelector("[data-slot=alert]")?.hasAttribute("role")).toBe(false);
  });
});
