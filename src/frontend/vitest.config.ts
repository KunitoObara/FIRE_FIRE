import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json の paths(`@/*`)をそのまま解決する
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    /*
      日時の表示はブラウザのタイムゾーンで整形するため(`format(parseISO(...))`)、
      期待値を書いたテストは実行環境のタイムゾーンで結果が変わる。CIはUTCで走り、
      手元は日本時間なので、固定しないと同じテストが場所によって赤くなる。
      利用者が日本にいる前提のアプリなので、テストもJSTに固定して実表示と揃える。
    */
    env: { TZ: "Asia/Tokyo" },
    // globalsは有効化せず、テストからは describe / it / expect を明示的にimportする
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
});
