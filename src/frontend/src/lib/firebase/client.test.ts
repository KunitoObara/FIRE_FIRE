import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as FirebaseClient from "@/lib/firebase/client";

// client.tsはモジュール読み込み時にFirebaseのSDKをimportするため、最小限のモックを置く。
// ここで検証したいのは初期化前の判定であって、SDKそのものの挙動ではない。
vi.mock("firebase/app", () => ({
  getApp: vi.fn(),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn((config: unknown) => ({ options: config })),
}));
vi.mock("firebase/auth", () => ({ getAuth: vi.fn(() => ({})) }));
vi.mock("firebase/firestore", () => ({ getFirestore: vi.fn(() => ({})) }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(() => ({})) }));

/** `.env.local`に入れている想定のSTG(fire-fire-dev)の設定値 */
const STG_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "fire-fire-dev.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fire-fire-dev",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "fire-fire-dev.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:abcdef",
};

const stubFirebaseEnv = (overrides: Record<string, string | undefined> = {}): void => {
  Object.entries({ ...STG_ENV, ...overrides }).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });
};

/**
 * client.tsは初期化済みのインスタンスをモジュールスコープにキャッシュするため、
 * ケースごとにモジュールを読み直してキャッシュを捨てる。
 */
const importClient = async (): Promise<typeof FirebaseClient> => {
  vi.resetModules();
  return import("@/lib/firebase/client");
};

beforeEach(() => {
  // `vi.mock`のモックはファイル内で使い回されるため、呼び出し履歴だけを毎回捨てる
  // (`resetAllMocks`だとモックの実装ごと消えてしまう)
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getFirebaseApp", () => {
  it("STG(fire-fire-dev)を指していれば、その設定値で初期化する", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFirebaseEnv();

    const { getFirebaseApp } = await importClient();
    const { initializeApp } = await import("firebase/app");

    expect(() => getFirebaseApp()).not.toThrow();
    expect(vi.mocked(initializeApp)).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "fire-fire-dev" }),
    );
  });

  /**
   * B0-1でエミュレータを廃止したため、接続先は`.env.local`の値だけで決まる。
   * 本番を指したまま開発すると本番に実アカウント・実データが入ってしまうので、
   * 初期化の時点で止まることを固定する。
   */
  it("ローカル開発で本番プロジェクトを指していたら初期化を止める", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFirebaseEnv({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fire-fire-prod" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getFirebaseApp, FirebaseConfigurationError } = await importClient();
    const { initializeApp } = await import("firebase/app");

    expect(() => getFirebaseApp()).toThrow(FirebaseConfigurationError);
    expect(() => getFirebaseApp()).toThrow(/fire-fire-prod/);
    // 実際に繋ぎに行く前に止まっていること
    expect(vi.mocked(initializeApp)).not.toHaveBeenCalled();
    // 画面には汎用の設定エラーしか出ないため、原因がコンソールに残ること
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("fire-fire-prod"));
  });

  it("本番ビルドでは本番プロジェクトを指していても止めない", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubFirebaseEnv({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fire-fire-prod" });

    const { getFirebaseApp } = await importClient();
    const { initializeApp } = await import("firebase/app");

    expect(() => getFirebaseApp()).not.toThrow();
    expect(vi.mocked(initializeApp)).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "fire-fire-prod" }),
    );
  });

  it("設定値が不足していればFirebaseConfigurationErrorを投げる", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFirebaseEnv({ NEXT_PUBLIC_FIREBASE_API_KEY: "" });

    const { getFirebaseApp, FirebaseConfigurationError } = await importClient();

    expect(() => getFirebaseApp()).toThrow(FirebaseConfigurationError);
    expect(() => getFirebaseApp()).toThrow(/apiKey/);
  });
});
