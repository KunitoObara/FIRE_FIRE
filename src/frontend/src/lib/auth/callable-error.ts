import { z } from "zod";

import { FirebaseConfigurationError } from "@/lib/firebase/client";

/**
 * Cloud Functions(callable)の失敗を画面用の理由に読み替える共通処理。
 *
 * リカバリーコードの発行・使用(A3・A5・B10)と2FAの再設定(B10)はどれも同じ形の
 * エラーを返す。`code`はFirebaseが付ける`functions/*`のコード、`details.reason`は
 * バックエンドが載せた機械可読な理由(src/backend/src/mfa-recovery/functions.ts)。
 */

/**
 * `instanceof`に頼らずプロパティを検証するのは、SDKの実装(FunctionsError)に
 * 依存せずに済ませるため。
 */
const callableErrorSchema = z.object({
  code: z.string(),
  details: z.object({ reason: z.string() }).optional(),
});

/**
 * バックエンドの理由のうち、画面側で別の呼び方をするもの。
 * `unauthenticated`は他の画面と揃えて`signed-out`と呼ぶ。
 */
const REASON_ALIASES: Record<string, string> = { unauthenticated: "signed-out" };

/**
 * callableが投げたエラーを、呼び出し側が扱える理由に変換する。
 *
 * `knownReasons`に無い理由やそもそも理由が載っていない場合は、Firebaseのエラーコードから
 * 決め直す。callableに到達できなかった場合もSDKは`functions/internal`を投げるため、
 * 通信不能とサーバー側の想定外エラーは区別せず`unavailable`に寄せる
 * (どちらも画面では「時間をおいて再試行」以外にできることが無い)。
 */
export const toCallableFailureReason = <Reason extends string>(
  error: unknown,
  knownReasons: readonly Reason[],
  logMessage: string,
): Reason | CallableSharedFailureReason => {
  if (error instanceof FirebaseConfigurationError) {
    return "configuration-error";
  }

  const parsed = callableErrorSchema.safeParse(error);

  if (!parsed.success) {
    console.error(logMessage, error);
    return "unknown";
  }

  const rawReason = parsed.data.details?.reason;
  const reason = rawReason === undefined ? undefined : (REASON_ALIASES[rawReason] ?? rawReason);
  const known = knownReasons.find((candidate) => candidate === reason);

  if (known !== undefined) {
    return known;
  }

  console.error(logMessage, parsed.data.code);

  return parsed.data.code === "functions/internal" || parsed.data.code === "functions/unavailable"
    ? "unavailable"
    : "unknown";
};
