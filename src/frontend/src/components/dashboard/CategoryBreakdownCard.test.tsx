import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryBreakdownCard } from "@/components/dashboard/CategoryBreakdownCard";
import { DEBT_CATEGORY_ID, PROPERTY_CATEGORY_ID } from "@/constants/dashboard";

/** 円グラフはブラウザ専用(next/dynamic)なので、ここでは中身を描画対象にしない */
vi.mock("@/components/dashboard/CategoryBreakdownChart", () => ({
  CategoryBreakdownChart: () => <div data-testid="category-breakdown-chart" />,
}));

const slice = (
  categoryId: string,
  name: string,
  riskLevel: AssumptionRiskLevel | null,
): AssetBreakdownSlice => ({
  categoryId,
  name,
  amount: 1_000_000,
  ratio: 0.5,
  color: "var(--chart-1)",
  riskLevel,
});

/** 凡例の行を分類名から引く */
const legendRow = (name: string): HTMLElement => {
  const row = screen.getByText(name).closest("li");

  if (row === null) {
    throw new Error(`凡例に${name}の行が無い`);
  }

  return row;
};

describe("CategoryBreakdownCard の凡例", () => {
  /**
   * 形状と文字はB9と同じものを使う(docs/screen-requirements-dashboard.md B1
   * 「リスクの可視化」)。同じリスクレベルが画面によって違う形になると対応が読めない。
   */
  it("リスクレベルを設定した資産種別には、形状と文字を添える", () => {
    render(
      <CategoryBreakdownCard
        axisName="投資性資産"
        slices={[slice("株式(現物)", "株式(現物)", "high")]}
        netAmount={null}
      />,
    );

    expect(within(legendRow("株式(現物)")).getByText("高")).toBeInTheDocument();
  });

  /**
   * **色は借りない。** この行には分類のスロット色が既に並んでおり、低リスクの
   * `--chart-1` は分類側の色と同じ値になるため、2種類の意味の色を読み分けられない(要件)。
   */
  it("リスクレベルに色を当てない", () => {
    render(
      <CategoryBreakdownCard
        axisName="投資性資産"
        slices={[slice("預金・現金", "預金・現金", "low")]}
        netAmount={null}
      />,
    );

    const icon = legendRow("預金・現金").querySelector("svg");

    expect(icon).not.toBeNull();
    // B9のリスク色(text-chart-1 / 4 / 8)を持ち込んでいないこと
    expect(icon?.getAttribute("class")).not.toMatch(/text-chart-/);
  });

  /** 「未設定」のバッジを並べると、まだ何も置いていない状態で凡例が最も混み合う(要件) */
  it("リスクレベルが未設定の資産種別には何も出さない", () => {
    render(
      <CategoryBreakdownCard
        axisName="投資性資産"
        slices={[slice("投資信託", "投資信託", null)]}
        netAmount={null}
      />,
    );

    const row = legendRow("投資信託");

    expect(within(row).queryByText("未設定")).not.toBeInTheDocument();
    expect(row.querySelector("svg")).toBeNull();
  });

  /** 「不動産」「負債」はB9に対応する行そのものが無い(要件) */
  it("擬似分類の行にはリスクレベルを出さない", () => {
    render(
      <CategoryBreakdownCard
        axisName="純資産"
        slices={[
          slice(PROPERTY_CATEGORY_ID, "不動産", null),
          slice(DEBT_CATEGORY_ID, "負債", null),
        ]}
        netAmount={5_000_000}
      />,
    );

    expect(legendRow("不動産").querySelector("svg")).toBeNull();
    expect(legendRow("負債").querySelector("svg")).toBeNull();
  });

  /**
   * 凡例の行は「分類名 リスク 構成比 金額」と読み上げられる。「高」の1文字だけでは
   * 何の段階なのかが音声では分からないため、読み上げ用のラベルを前に付ける。
   */
  it("リスクレベルには読み上げ用のラベルを添える", () => {
    render(
      <CategoryBreakdownCard
        axisName="投資性資産"
        slices={[slice("株式(現物)", "株式(現物)", "medium")]}
        netAmount={null}
      />,
    );

    expect(within(legendRow("株式(現物)")).getByText("リスク")).toBeInTheDocument();
  });
});
