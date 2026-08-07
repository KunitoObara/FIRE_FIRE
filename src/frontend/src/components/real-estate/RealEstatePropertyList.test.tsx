import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RealEstatePropertyList } from "@/components/real-estate/RealEstatePropertyList";

const properties: RealEstateProperty[] = [
  {
    id: "shibuya-101",
    name: "〇〇マンション101号室",
    location: "東京都渋谷区神南1-2-3",
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
    updatedAt: "2026-06-01",
  },
  {
    id: "chiba-house",
    name: "□□戸建て",
    location: "千葉県市川市八幡7-8-9",
    marketValue: 18_000_000,
    loanBalance: 0,
    updatedAt: "2026-04-02",
  },
];

describe("RealEstatePropertyList", () => {
  it("物件名・所在地(簡略)・時価・ローン残高を表示する", () => {
    render(<RealEstatePropertyList properties={properties} />);

    const row = within(screen.getByRole("link", { name: /〇〇マンション101号室/u }));

    expect(row.getByText("東京都渋谷区")).toBeInTheDocument();
    expect(row.getByText("¥ 32,000,000")).toBeInTheDocument();
    expect(row.getByText("¥ 18,400,000")).toBeInTheDocument();
  });

  it("物件行からB6 不動産詳細画面へ遷移できる", () => {
    render(<RealEstatePropertyList properties={properties} />);

    expect(screen.getByRole("link", { name: /〇〇マンション101号室/u })).toHaveAttribute(
      "href",
      "/real-estate/shibuya-101",
    );
    expect(screen.getByRole("link", { name: /□□戸建て/u })).toHaveAttribute(
      "href",
      "/real-estate/chiba-house",
    );
  });

  it("利ざや(時価-ローン残高)は一覧に表示しない", () => {
    render(<RealEstatePropertyList properties={properties} />);

    expect(screen.queryByText("利ざや")).not.toBeInTheDocument();
    // 〇〇マンション101号室の利ざや(32,000,000 - 18,400,000)
    expect(screen.queryByText("¥ 13,600,000")).not.toBeInTheDocument();
  });
});
