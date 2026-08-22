import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";

import { detectSignUpBlockedReason } from "./signup-allowlist-error";

/**
 * サインアップ制限による拒否の判定(docs/auth-login-requirements.md 3.10)。
 *
 * 判定の材料はエラーメッセージの中身しか無いため、**実物のレスポンスを固定しておく**。
 * 下の文字列は `fire-fire-dev` へデプロイした関数に対して
 * `identitytoolkit.googleapis.com/v1/accounts:signUp` を叩いて得た応答を、
 * **SDKが `FirebaseError` として投げ直す形**(`' : '` で分解した後半のみ)に直したものである。
 * Identity PlatformやSDKが包み方を変えたらこのテストが落ちる、という形にしておく。
 */

/** 実物のレスポンスから起こした、SDKがエラーメッセージに残す文字列 */
const blockingFunctionMessage = (status: string, message: string): string =>
  `Firebase: HTTP Cloud Function returned an error: {"error":{"message":"${message}","status":"${status}"}} (auth/internal-error).`;

/**
 * SDKは `BLOCKING_FUNCTION_ERROR_RESPONSE : <以降>` を分解し、**コロンより後ろだけ**を
 * エラーメッセージとして残す。前置きの `BLOCKING_FUNCTION_ERROR_RESPONSE` は
 * エラーマップのキーに使われるだけで `error.message` には入らないため、ここでも足さない。
 *
 * **この固定値がSDKの実際の出力とずれていないことは、`signup-allowlist-error.sdk.test.ts`
 * が実物のSDKに組み立てさせて確かめている。** かつてここに前置きを足していたために、
 * 判定が実際には一度も成立しないままテストだけが緑だった([A1](https://trello.com/c/idgZRaS3))。
 */
const internalError = (message: string): FirebaseError =>
  new FirebaseError("auth/internal-error", message);

describe("detectSignUpBlockedReason", () => {
  it("PERMISSION_DENIED は未承認として扱う", () => {
    const error = internalError(
      blockingFunctionMessage(
        "PERMISSION_DENIED",
        "現在、アカウントの作成は招待された方のみに限らせていただいています。",
      ),
    );

    expect(detectSignUpBlockedReason(error)).toBe("not-allowed");
  });

  it("INTERNAL は「確かめられなかった」として扱う", () => {
    // fail-closedで拒否された場合。招待済みの人に「招待されていない」と伝えないため、
    // 未承認とは別の理由に振り分ける
    const error = internalError(
      blockingFunctionMessage(
        "INTERNAL",
        "アカウントの作成を受け付けられませんでした。時間をおいて再度お試しください。",
      ),
    );

    expect(detectSignUpBlockedReason(error)).toBe("unavailable");
  });

  it("日本語の文言に依存しない", () => {
    // バックエンドの文言を変えても判定は保たれる。文言で判定すると黙って壊れる
    const error = internalError(blockingFunctionMessage("PERMISSION_DENIED", "文言を変えました"));

    expect(detectSignUpBlockedReason(error)).toBe("not-allowed");
  });

  it("Blocking Function 由来でない auth/internal-error は対象外", () => {
    // 別の原因の内部エラーを「招待されていません」と表示しない
    expect(
      detectSignUpBlockedReason(
        new FirebaseError("auth/internal-error", "Firebase: An internal AuthError has occurred."),
      ),
    ).toBeNull();
  });

  it("他のエラーコードは対象外", () => {
    expect(
      detectSignUpBlockedReason(new FirebaseError("auth/email-already-in-use", "…")),
    ).toBeNull();
  });

  it("FirebaseError でないものは対象外", () => {
    expect(detectSignUpBlockedReason(new Error("boom"))).toBeNull();
    expect(detectSignUpBlockedReason(undefined)).toBeNull();
  });

  it("包み方が変わって status を読めない場合は判定しない", () => {
    // 無理に読まず null を返し、既存の「不明なエラー」の文言に落とす。
    // 取り違えて「招待されていません」を出すより、汎用の文言のほうが害が小さい
    const error = internalError("HTTP Cloud Function returned an error: something unexpected");

    expect(detectSignUpBlockedReason(error)).toBeNull();
  });
});
