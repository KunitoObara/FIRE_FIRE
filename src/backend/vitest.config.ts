import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * テスト対象は`src`のTypeScriptだけに絞る。
     *
     * `tsc`のビルド成果物にはテストのJavaScript(`lib/**\/*.test.js`)も含まれるため、
     * 既定の探索範囲のままだとビルド後に同じテストをCommonJSとして二重に拾い、
     * 「Vitest cannot be imported in a CommonJS module」で失敗する
     * (CIはビルド→テストの順に実行するため、ローカルの実行順によっては再現しない)。
     */
    include: ["src/**/*.test.ts"],
  },
});
