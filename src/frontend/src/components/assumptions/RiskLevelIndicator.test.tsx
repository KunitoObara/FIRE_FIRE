import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RiskLevelIndicator } from "@/components/assumptions/RiskLevelIndicator";

/**
 * B9の選択肢一覧・選択済み表示のトンマナ(Y-01 3本目)。モックの角丸バッジを
 * `--chart-1/4/8`の低不透明度背景で再現する。B1凡例(`colored=false`)側は
 * `CategoryBreakdownCard.test.tsx`が別途カバーしている。
 */
describe("RiskLevelIndicator", () => {
  it.each([
    ["low", "低", "bg-chart-1/10", "text-chart-1"],
    ["medium", "中", "bg-chart-4/10", "text-chart-4"],
    ["high", "高", "bg-chart-8/10", "text-chart-8"],
  ] as const)(
    "colored(既定)では%sをbg/text色付きバッジで表示する",
    (level, label, bgClass, textClass) => {
      render(<RiskLevelIndicator level={level} />);

      const badge = screen.getByText(label).closest('[data-slot="badge"]');

      expect(badge).not.toBeNull();
      expect(badge?.className).toContain(bgClass);
      expect(badge?.className).toContain(textClass);
    },
  );

  it("未設定の値はバッジ化せず「未設定」の文字だけを出す", () => {
    render(<RiskLevelIndicator level="unset" />);

    expect(screen.getByText("未設定").closest('[data-slot="badge"]')).toBeNull();
  });
});
