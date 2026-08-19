import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HelpPage from "@/app/(public)/help/page";
import { HELP_FAQ_ITEMS, HELP_GLOSSARY_TERMS, HELP_USAGE_STEPS } from "@/constants/public";

/**
 * A12は最小限の静的1ページで、確かめるのは要件が決めた構成(3セクションがこの順で並ぶこと)と、
 * 定数から漏れなく描画されることだけである(docs/screen-requirements-public.md A12)。
 */
describe("A12 ヘルプページ", () => {
  it("見出しを表示する", () => {
    render(<HelpPage />);

    expect(screen.getByRole("heading", { level: 1, name: "ヘルプ" })).toBeInTheDocument();
  });

  it("使い方・よくある質問・用語集の順でセクション見出しを並べる", () => {
    render(<HelpPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["使い方", "よくある質問", "用語集"]);
  });

  it("使い方の手順をすべて表示する", () => {
    render(<HelpPage />);

    for (const step of HELP_USAGE_STEPS) {
      expect(screen.getByText(step.title)).toBeInTheDocument();
    }
  });

  it("よくある質問の項目をすべて表示する", () => {
    render(<HelpPage />);

    for (const item of HELP_FAQ_ITEMS) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
  });

  it("用語集の項目をすべて表示する", () => {
    render(<HelpPage />);

    for (const entry of HELP_GLOSSARY_TERMS) {
      expect(screen.getByText(entry.term)).toBeInTheDocument();
    }
  });
});
