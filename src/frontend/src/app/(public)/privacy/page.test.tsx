import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/(public)/privacy/page";

/**
 * A9と同じく文面は雛形だが、**「取得する情報」「取得しない情報」「外部サービスの利用」の
 * 3項は実装から来る事実**である(docs/screen-requirements-public.md A10)。
 * 実装を変えたときにここが落ちれば、ポリシー側の直し忘れに気付ける。
 */
describe("A10 プライバシーポリシー画面", () => {
  it("見出しと制定日・最終改定日を表示する", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" }),
    ).toBeInTheDocument();
    expect(screen.getByText("制定日:2026年8月15日 / 最終改定日:2026年8月15日")).toBeInTheDocument();
  });

  it("要件の順で各項を並べる", () => {
    render(<PrivacyPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "1. 取得する情報",
      "2. 取得しない情報",
      "3. 利用目的",
      "4. 外部サービスの利用",
      "5. データの保管と削除",
      "6. Cookie等の利用",
      "7. 安全管理",
      "8. お問い合わせ先",
      "9. 本ポリシーの変更",
    ]);
  });

  /**
   * 生CSVを保存しない設計(要件定義書 4.2)は、扱う情報が資産データであるだけに
   * 利用者が最も知りたい部分で、書かなければ伝わらない。
   */
  it("取り込んだCSVファイル自体を保存しないことを明示する", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText("取り込んだCSVファイルそのものは保存していません。"),
    ).toBeInTheDocument();
  });

  /** 「委託先」とだけ書いて社名を伏せると、どこにデータが渡るかが読めない */
  it("外部サービスを社名で書く", () => {
    render(<PrivacyPage />);

    expect(screen.getByText("Google(Firebase / Google Cloud)")).toBeInTheDocument();
    expect(screen.getByText("Resend")).toBeInTheDocument();
  });

  /**
   * 受信できるアドレスの用意は [X4] のドメイン接続と同時に行う。それまでは届かないアドレスを
   * 載せず、準備中であることだけを書く(代わりの受け口は [X6] で検討する)。
   */
  it("お問い合わせ先はメールアドレスを載せず準備中と書く", () => {
    const { container } = render(<PrivacyPage />);

    expect(
      screen.getByText(
        "本ポリシーに関するお問い合わせ先は現在準備中です。用意ができしだい、本ページに掲載します。",
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/@/);
  });
});
