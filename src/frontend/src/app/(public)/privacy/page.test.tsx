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
   * 画面から消せる範囲は実装で決まっている。資産分類・不動産・負債には削除の操作があるが、
   * CSV取込の資産残高・入出金明細は参照専用で削除できない
   * (docs/transaction-import-requirements.md 10章)。「登録データを削除できます」とだけ
   * 書くと、消せないものまで消せると読める。
   */
  it("画面から削除できないデータがあることを書く", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(
        "CSVから取り込んだ資産残高および入出金明細は参照専用のため、画面からは削除できません",
      ),
    ).toBeInTheDocument();
  });

  /**
   * アカウントの削除は登録データの削除とは別物で、B10から実行できる([X7]、
   * docs/auth-login-requirements.md 3.11)。Googleのみのアカウントは本人確認を
   * 通せないため画面からは実行できず、そちらだけが問い合わせになる。
   */
  it("アカウントの削除を自分で実行できることと、例外を書く", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(
        "アカウントの削除は、ログイン後のアカウント設定画面からご自身で実行できます。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Googleのみでログインしているアカウントは画面から削除できないため/),
    ).toBeInTheDocument();
  });

  /**
   * 問い合わせ先はA11のフォームで、**メールアドレスは載せない**([X6])。公開リポジトリに
   * 開発者本人のアドレスを置けないため、宛先はサーバー側のシークレットにだけ持たせている。
   */
  it("お問い合わせ先はメールアドレスを載せずA11へ送る", () => {
    const { container } = render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "お問い合わせフォーム" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(container.textContent).not.toMatch(/@/);
  });
});
