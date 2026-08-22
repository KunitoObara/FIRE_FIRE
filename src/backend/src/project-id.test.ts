import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveProjectId } from "./project-id";

/**
 * プロジェクトIDの解決([X3]で`login-notification`から切り出した)。
 *
 * ログイン通知の`[dev]`表示とSentryの`environment`が同じ判定を使う。
 * ここがずれると、同じ実行なのに2つの表示が食い違う。
 */

const PROJECT_ENV_KEYS = ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT"] as const;

const clearProjectEnv = (): void => {
  for (const key of PROJECT_ENV_KEYS) {
    delete process.env[key];
  }
  delete process.env.FIREBASE_CONFIG;
};

beforeEach(clearProjectEnv);
afterEach(clearProjectEnv);

describe("resolveProjectId", () => {
  it("GCLOUD_PROJECTを最優先で使う", () => {
    process.env.GCLOUD_PROJECT = "fire-fire-prod";
    process.env.GOOGLE_CLOUD_PROJECT = "fire-fire-dev";

    expect(resolveProjectId()).toBe("fire-fire-prod");
  });

  it("GCLOUD_PROJECTが無ければGOOGLE_CLOUD_PROJECTを見る", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "fire-fire-dev";

    expect(resolveProjectId()).toBe("fire-fire-dev");
  });

  it("環境変数が無くてもFIREBASE_CONFIGから拾う", () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "fire-fire-dev" });

    expect(resolveProjectId()).toBe("fire-fire-dev");
  });

  it("空文字の環境変数は未設定として扱い、FIREBASE_CONFIGへ落ちる", () => {
    process.env.GCLOUD_PROJECT = "";
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "fire-fire-dev" });

    expect(resolveProjectId()).toBe("fire-fire-dev");
  });

  it("FIREBASE_CONFIGが壊れていても例外にせず空文字を返す", () => {
    /*
      呼び出し元(ログイン通知・Sentryの初期化)は、どちらもこの値のために
      止まってはいけない処理。**判定できないことを理由に落とさない**。
    */
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.FIREBASE_CONFIG = "{壊れたJSON";

    expect(resolveProjectId()).toBe("");
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("どこにも無ければ空文字を返す(本番ではない側へ倒す)", () => {
    expect(resolveProjectId()).toBe("");
  });
});
