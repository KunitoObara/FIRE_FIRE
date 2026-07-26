import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json の paths(`@/*`)をそのまま解決する
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    // globalsは有効化せず、テストからは describe / it / expect を明示的にimportする
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
});
