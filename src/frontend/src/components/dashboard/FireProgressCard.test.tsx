import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FireProgressCard } from "@/components/dashboard/FireProgressCard";

/** ゲージはブラウザ専用(next/dynamic)なので、ここでは中身を描画対象にしない */
vi.mock("@/components/dashboard/FireProgressGauge", () => ({
  FireProgressGauge: () => <div data-testid="fire-progress-gauge" />,
}));

const fireProgress = (projection: FireProjection | null): FireProgress => ({
  targetAmount: 80_000_000,
  currentAmount: 49_600_000,
  achievementAxisName: "総資産(マネーフォワードの合計)",
  achievementAxisMissing: false,
  projection,
});

describe("FireProgressCard の到達予測日", () => {
  /** 予測値であって確定日ではないため「頃」を添え、日付までは出さない(要件B1) */
  it("到達月は年月までを「頃」付きで出す", () => {
    render(
      <FireProgressCard
        fireProgress={fireProgress({ status: "projected", achievementDate: "2033-04-01" })}
      />,
    );

    expect(screen.getByText("2033年4月頃")).toBeInTheDocument();
  });

  it("現在資産額が目標以上なら達成済みと出す", () => {
    render(<FireProgressCard fireProgress={fireProgress({ status: "achieved" })} />);

    expect(screen.getByText("達成済み")).toBeInTheDocument();
  });

  /**
   * 原因は想定利回り(B9)側とは限らず、積立額(B8)がマイナスで資産が減り続ける場合もある。
   * 片方に絞ると、B8起因のときに直す先が画面に出ない(要件B1「到達予測日」)。
   */
  it("到達見込みなしのときは、B9とB8の両方への導線を添える", () => {
    render(<FireProgressCard fireProgress={fireProgress({ status: "unreachable" })} />);

    expect(screen.getByText("到達見込みなし")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "想定利回りを設定する" })).toHaveAttribute(
      "href",
      "/assumptions",
    );
    expect(screen.getByRole("link", { name: "積立額を見直す" })).toHaveAttribute(
      "href",
      "/fire-goal",
    );
  });

  it("到達月が出ているときは、見込みなしの案内を出さない", () => {
    render(
      <FireProgressCard
        fireProgress={fireProgress({ status: "projected", achievementDate: "2033-04-01" })}
      />,
    );

    expect(screen.queryByRole("link", { name: "想定利回りを設定する" })).not.toBeInTheDocument();
  });

  /** B9の想定値を取得できなかった場合の保険。ゲージや現在資産額はそのまま出す(要件) */
  it("予測が算出できなかった場合も、ゲージと現在資産額は出す", () => {
    render(<FireProgressCard fireProgress={fireProgress(null)} />);

    expect(screen.getByText("算出できません")).toBeInTheDocument();
    expect(screen.getByText("¥ 49,600,000")).toBeInTheDocument();
  });

  /** 目標未設定はカードごと空状態になり、到達予測日の欄そのものが現れない(要件) */
  it("目標が未設定ならカードごと空状態にし、到達予測日の欄を出さない", () => {
    render(<FireProgressCard fireProgress={null} />);

    expect(screen.queryByText("到達予測日")).not.toBeInTheDocument();
    // 見出しと空状態の2か所に同じ導線が出る(空状態の既存の作り)
    expect(screen.getAllByRole("link", { name: "目標を設定する" }).length).toBeGreaterThan(0);
  });
});
