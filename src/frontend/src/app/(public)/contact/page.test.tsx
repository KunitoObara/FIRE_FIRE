import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContactPage from "@/app/(public)/contact/page";

vi.mock("@/components/public/ContactForm", () => ({
  // 送信の挙動はContactForm側でテストする。ここでは画面の器だけを見る
  ContactForm: () => <form data-testid="contact-form" />,
}));

describe("A11 お問い合わせ画面(docs/screen-requirements-public.md A11)", () => {
  it("見出しと説明、フォームを並べる", () => {
    render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "お問い合わせ" })).toBeInTheDocument();
    expect(screen.getByText(/ご返信します/)).toBeInTheDocument();
    expect(screen.getByTestId("contact-form")).toBeInTheDocument();
  });

  /**
   * 宛先はサーバー側のシークレットにだけ置く(`src/backend/src/contact/functions.ts`)。
   * 公開リポジトリに開発者本人のアドレスを書けないため、画面にも出さない(CLAUDE.md)。
   */
  it("問い合わせ先のメールアドレスを画面に出さない", () => {
    const { container } = render(<ContactPage />);

    expect(container.textContent).not.toMatch(/@/);
  });
});
