import { FirebaseError } from "firebase/app";
import { afterEach, describe, expect, it, vi } from "vitest";

import { detectSignUpBlockedReason } from "./signup-allowlist-error";

/**
 * `detectSignUpBlockedReason` の回帰テスト。**判定対象の `FirebaseError` を手で組み立てず、
 * 実物の `@firebase/auth` に組み立てさせる。**
 *
 * `signup-allowlist-error.test.ts` は判定の分岐そのものを見るテストで、入力は手書きの固定値に
 * なる。かつてその固定値がSDKの実際の出力とずれており(`BLOCKING_FUNCTION_ERROR_RESPONSE` の
 * 前置きは `error.message` に残らない)、**判定が一度も成立しないままテストだけが緑**だった
 * ([A1](https://trello.com/c/idgZRaS3))。固定値を直しても、次にSDKが包み方を変えれば同じ
 * 壊れ方をする。ここではSDKへの入力を**Identity Platformの生の応答**まで遡らせ、
 * `createUserWithEmailAndPassword` が実際に投げるエラーを判定に食わせる。
 *
 * **ネットワークには出ない。** `fetch` を差し替えて、`fire-fire-dev` で実測した応答本文を返す。
 *
 * 差し替えは**`firebase/auth` を読み込む前**に済ませる必要がある。vitest(Node実行)が解決する
 * のはSDKのNode向けビルドで、そちらは読み込み時に `FetchProvider.initialize(fetch, …)` で
 * `fetch` を捕まえてしまうため、後から `vi.stubGlobal` しても効かない。そのため静的importでは
 * なく、スタブを入れたあとの動的importでSDKを読み込む。
 * エラーの整形を行う `_performFetchWithErrorHandling` はブラウザ向けビルドと同一の実装で、
 * 画面が実際に使うビルドとの差はここでは問題にならない。
 */

/** 差し替えた `fetch` が返す応答。テストごとに `respondWithBlockingFunctionError` で入れ替える */
let nextResponse: { ok: boolean; status: number; json: () => Promise<unknown> } | undefined;

// SDKが見るのは `response.ok` と `response.json()` だけなので、その2つだけを備えた応答を返す
vi.stubGlobal("fetch", () => {
  if (!nextResponse) {
    throw new Error("応答を設定せずにfetchが呼ばれた");
  }

  return Promise.resolve(nextResponse);
});

const { deleteApp, initializeApp } = await import("firebase/app");
const { createUserWithEmailAndPassword, getAuth } = await import("firebase/auth");

/**
 * Identity Platform が `accounts:signUp` で返すエラー本文(HTTP 400)。
 * Blocking Function の `HttpsError` は `error.message` の中にこの形で入れ子になる。
 */
const respondWithBlockingFunctionError = (status: string, message: string): void => {
  const body = {
    error: {
      code: 400,
      message: `BLOCKING_FUNCTION_ERROR_RESPONSE : HTTP Cloud Function returned an error: {"error":{"message":"${message}","status":"${status}"}}`,
      errors: [
        { message: "BLOCKING_FUNCTION_ERROR_RESPONSE", domain: "global", reason: "invalid" },
      ],
      status: "INVALID_ARGUMENT",
    },
  };

  nextResponse = { ok: false, status: 400, json: () => Promise.resolve(body) };
};

/**
 * 実際にサインアップを試み、SDKが投げたエラーを返す。
 *
 * 設定値は形式さえ満たしていればよい(通信しないため)。`.env.local` を読ませると、
 * 手元とCIでテストの前提が変わる。
 */
const signUpAndCatch = async (): Promise<unknown> => {
  const app = initializeApp(
    {
      apiKey: "test-api-key",
      authDomain: "example.firebaseapp.com",
      projectId: "example",
      storageBucket: "example.firebasestorage.app",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000",
    },
    // 既定のアプリ名を使うと、同じプロセスの他のテストと初期化を取り合う
    `signup-allowlist-sdk-${crypto.randomUUID()}`,
  );

  try {
    await createUserWithEmailAndPassword(getAuth(app), "taro.yamada@example.com", "Test-Pass123!");
  } catch (error) {
    return error;
  } finally {
    await deleteApp(app);
  }

  throw new Error("サインアップが失敗しなかった(fetchの差し替えが効いていない)");
};

describe("detectSignUpBlockedReason(実物のSDKが投げたエラー)", () => {
  afterEach(() => {
    nextResponse = undefined;
  });

  it("未承認のメールアドレスでの拒否を not-allowed と判定する", async () => {
    respondWithBlockingFunctionError(
      "PERMISSION_DENIED",
      "現在、アカウントの作成は招待された方のみに限らせていただいています。",
    );

    expect(detectSignUpBlockedReason(await signUpAndCatch())).toBe("not-allowed");
  });

  it("許可リストを読めなかった場合(fail-closed)を unavailable と判定する", async () => {
    respondWithBlockingFunctionError(
      "INTERNAL",
      "アカウントの作成を受け付けられませんでした。時間をおいて再度お試しください。",
    );

    expect(detectSignUpBlockedReason(await signUpAndCatch())).toBe("unavailable");
  });

  it("SDKが投げるメッセージに BLOCKING_FUNCTION_ERROR_RESPONSE は残らない", async () => {
    // 今回のバグの原因そのものを固定する。前置きは `' : '` の分割でエラーマップのキーに
    // 使われるだけで、`error.message` に入るのは後半だけ。判定材料に使えるのは
    // `status` を含むJSONのほうである
    respondWithBlockingFunctionError("PERMISSION_DENIED", "文言は判定に使わない");

    const error = await signUpAndCatch();

    expect(error).toBeInstanceOf(FirebaseError);
    const { code, message } = error as FirebaseError;
    expect(code).toBe("auth/internal-error");
    expect(message).not.toContain("BLOCKING_FUNCTION_ERROR_RESPONSE");
    expect(message).toContain('"status":"PERMISSION_DENIED"');
  });
});
