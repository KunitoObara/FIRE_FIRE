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
  // Identity Platformのレート制限に配慮し、同時実行数を絞る([X18]のリファインメント時に
  // POと合意した実行環境の方針。development-workflow.mdには章立てされていない)。
  // CI組み込みは[X20]で別途検討する
  fullyParallel: false,
  workers: 1,
  // 常に0(CI/ローカルで分岐していない)。CIには未組み込みのため今は実害が無いが、
  // [X20]でCIに組み込む際はCI環境でのリトライ要否とあわせて見直す
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    // retriesが常に0の間はリトライ自体が起きないため実質発火しない。[X20]でretriesを
    // 有効にするときに合わせて効かせる
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
