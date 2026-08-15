import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TopPage from "@/app/(public)/page";

vi.mock("@/components/public/PublicAuthActions", () => ({
  // 導線の出し分けはPublicAuthActions側でテストする。ここでは置いた箇所と設定だけを見る
  PublicAuthActions: ({ size, withInviteOnlyNotice }: PublicAuthActionsProps) => (
    <span data-testid="auth-actions" data-size={size} data-invite-notice={withInviteOnlyNotice}>
      導線
    </span>
  ),
}));

describe("A0 サービストップページ(docs/screen-requirements-public.md A0)", () => {
  it("要件の順でセクションを並べる", () => {
    render(<TopPage />);

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["できること", "使い方", "ご利用にあたって", "まずは手元のCSVから。"]);
  });

  it("キャッチコピーを見出しに出す", () => {
    render(<TopPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "自分の資産を、自分の分類で数える。",
    );
  });

  /**
   * **載せるのは実装済みの機能だけ。** Phase 5〜7の機能や「近日公開」の予告は置かない。
   * CSV取込は手段なので「使い方」側で説明する(要件A0)。
   */
  it("できることに実装済みの機能を4つ並べる", () => {
    render(<TopPage />);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual([
      "資産の推移を1枚で見る",
      "分類の切り口を自分で決める",
      "不動産と負債まで含めて数える",
      "FIRE到達予測日が出る",
    ]);
  });

  /** 1ステップ目でマネーフォワード前提を明記する。伏せると登録した人が最初に詰まる */
  it("使い方の1ステップ目にマネーフォワードを明記する", () => {
    render(<TopPage />);

    expect(screen.getByText("マネーフォワードからCSVをエクスポートする")).toBeInTheDocument();
  });

  /**
   * ベータ版であることは**2箇所**に書く(要件A0)。バッジだけだと読み飛ばされ、
   * セクションだけだと下までスクロールした人にしか届かない。
   */
  it("ベータ版であることをヒーローのバッジとセクションの2箇所に書く", () => {
    render(<TopPage />);

    expect(screen.getAllByText("ベータ版")).toHaveLength(2);
  });

  it("ご利用にあたってに承知しておくべきことを並べる", () => {
    render(<TopPage />);

    expect(screen.getByText("データが失われる可能性があります。")).toBeInTheDocument();
    expect(screen.getByText("現在は招待制です。")).toBeInTheDocument();
    expect(screen.getByText("投資助言を行うものではありません。")).toBeInTheDocument();
  });

  /**
   * ヘッダーだけを差し替えると、画面の真ん中でログイン中のユーザーに「サインアップ」を
   * 勧め続けることになる(要件2章)。ページ内のCTAはヒーローと下部の2箇所。
   */
  it("ページ内のCTAを2箇所に置き、どちらも共通の導線コンポーネントで作る", () => {
    render(<TopPage />);

    const actions = screen.getAllByTestId("auth-actions");

    expect(actions).toHaveLength(2);
    expect(actions.every((action) => action.dataset.size === "lg")).toBe(true);
  });

  /** 招待制の注記は登録の案内なので、ヒーロー側にだけ添える(モックと同じ) */
  it("招待制の注記はヒーローのCTAにだけ添える", () => {
    render(<TopPage />);

    expect(
      screen.getAllByTestId("auth-actions").map((action) => action.dataset.inviteNotice),
    ).toEqual(["true", undefined]);
  });

  /** 実データのスクリーンショットは置けないため、ダミー値で描いたB1の簡略版を出す */
  it("ヒーローにB1の画面イメージを置く", () => {
    const { container } = render(<TopPage />);

    expect(
      screen.getByText(
        "ダッシュボード(B1)の画面イメージです。実際のデータではなく、説明のためのサンプルです。",
      ),
    ).toBeInTheDocument();
    // 資産推移・分類別内訳・FIRE達成度の3つ
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(3);
  });

  /**
   * 押せるナビも動く数字も無い装飾なので、読み上げの対象から外す。そのまま読み上げると
   * 本物のダッシュボードと区別が付かない(代わりにサンプルである旨の一文を出す)。
   */
  it("画面イメージの中身は読み上げの対象から外す", () => {
    render(<TopPage />);

    // ダミーのナビ・見出し・数値はいずれも aria-hidden の内側に置く
    expect(screen.getByText("純金融資産 ▾").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("資産推移(純金融資産)").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("ダッシュボード").closest("[aria-hidden]")).not.toBeNull();
  });

  /**
   * ゲージの対象分類は分類軸セレクタと揃えてあり、**対象分類名の併記は落とさない**
   * (docs/screen-requirements-dashboard.md)。数字も1組で辻褄が合っている
   * (差引後 30,000,000円 = 現在資産額、達成率38%)。
   */
  it("画面イメージの数字が1組で辻褄の合うダミー値になっている", () => {
    const { container } = render(<TopPage />);

    const preview = container.textContent ?? "";

    expect(preview).toContain("差引後 30,000,000円");
    expect(preview).toContain("現在資産額 30,000,000円(純金融資産)");
    expect(preview).toContain("目標資産額 80,000,000円");
    expect(preview).toContain("38%");
  });
});
