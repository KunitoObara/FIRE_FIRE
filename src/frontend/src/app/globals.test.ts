import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * クリッカブルな要素はhoverでcursor: pointerにする(Trelloカード Y-01)。
 *
 * Tailwindのユーティリティクラスはjsdom上でスタイルが適用されないため、コンポーネントの
 * レンダリング結果からは検証できない。`@layer base`のグローバルルールが存在することを
 * CSSを文字列として読んで確かめる(`src/constants/dashboard.test.ts`と同じ手法)。
 */
describe("globals.css", () => {
  // vitestの実行時のカレントディレクトリは`src/frontend`(vitest.config.ts の root)
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("無効化されていないbutton・[role=button]・aリンクにcursor: pointerを当てる", () => {
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor:\s*pointer;/u);
    expect(css).toContain('[role="button"]:not([aria-disabled="true"])');
    expect(css).toContain("a[href]");
  });
});
