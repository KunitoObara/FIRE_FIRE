import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Playwrightのテストプロセスはnext devと違い`.env.local`を自動で読まないため、明示的に読み込む。
// E2Eテストが使う資格情報(E2E_TEST_EMAIL等)はここに置く([X18] チェックリスト参照)。
loadEnv({ path: ".env.local" });

/**
 * [X18] E2Eテスト基盤構築。
 *
 * 接続先は常に`fire-fire-dev`(STG) — フロントの起動自体は`.env.local`が指すFirebase
 * プロジェクトに従うだけで(B0-1と同じ経路)、このファイルではFirebaseの向き先を切り替えない。
 * Firebase Emulatorは使わない(TOTP・メール確認・Googleログインが動かないため。CLAUDE.md B0-1)。
 *
 * 画面別の網羅的なテストケースは[X19]で追加する。ここでは基盤が機能することを示す
 * 疎通テスト(`e2e/smoke.spec.ts`)だけを対象にする。
 */
export default defineConfig({
  testDir: "./e2e",
  // Identity Platformのレート制限に配慮し、同時実行数を絞る(development-workflow.md 4章の
  // 「実行環境」に関する合意事項)。CI組み込みは[X20]で別途検討する
  fullyParallel: false,
  workers: 1,
  // 誤って本番向けの設定でCIに検知されずに残らないよう、CI環境ではリトライさせない
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // ローカルの`next dev`を自動起動する。既に起動済みなら再利用する(`reuseExistingServer`)。
  // ポートは3000ではなく3100を使う — worktreeでの並行作業中は他セッションの`npm run dev`が
  // 3000を使っていることがあり、衝突を避けるため
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
