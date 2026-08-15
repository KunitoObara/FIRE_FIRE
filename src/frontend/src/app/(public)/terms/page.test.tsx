import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TermsPage from "@/app/(public)/terms/page";

/**
 * 条文の文面そのものは雛形で、公開前にPOが内容を確認する。ここで確かめるのは
 * **要件定義書が決めた構成**(何をどの順で書くか)だけである
 * (docs/screen-requirements-public.md A9)。
 */
describe("A9 利用規約画面", () => {
  it("見出しと制定日・最終改定日を表示する", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "利用規約" })).toBeInTheDocument();
    expect(screen.getByText("制定日:2026年8月15日 / 最終改定日:2026年8月15日")).toBeInTheDocument();
  });

  it("第1条から第11条までを要件の順で並べる", () => {
    render(<TermsPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "第1条(適用)",
      "第2条(定義)",
      "第3条(アカウント登録・管理)",
      "第4条(ベータ版であることの確認)",
      "第5条(投資助言ではないこと)",
      "第6条(禁止事項)",
      "第7条(本サービスの提供の停止等)",
      "第8条(免責事項)",
      "第9条(サービス内容の変更・終了)",
      "第10条(本規約の変更)",
      "第11条(準拠法・裁判管轄)",
    ]);
  });

  /**
   * A0の「ベータ版について」と揃える。片方だけに書くと、どちらが本当かが読めない
   * (docs/screen-requirements-public.md A9)。
   */
  it("第4条でデータの滅失・毀損の可能性を明記する", () => {
    render(<TermsPage />);

    expect(screen.getByText("登録データが滅失・毀損する可能性があること。")).toBeInTheDocument();
  });

  /** 免責事項の一項目に混ぜると読み落とされるため、第5条として独立させている */
  it("投資助言ではないことを独立した条で書く", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(
        "本サービスは、投資助言・投資判断の代行・金融商品の勧誘を行うものではありません。",
      ),
    ).toBeInTheDocument();
  });

  /** 2FAが必須であることは第3条に置く(A1〜A3の実装と揃える) */
  it("2要素認証が必須であることを書く", () => {
    render(<TermsPage />);

    expect(
      screen.getByText("本サービスの利用には、認証アプリによる2要素認証の登録が必須です。"),
    ).toBeInTheDocument();
  });
});
