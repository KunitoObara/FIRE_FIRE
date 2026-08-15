import { httpsCallable } from "firebase/functions";

import { SEND_CONTACT_MESSAGE_FUNCTION } from "@/constants/firebase";
import { toCallableFailureReason } from "@/lib/auth/callable-error";
import { getFirebaseFunctions } from "@/lib/firebase/client";

/**
 * A11 お問い合わせの送信(docs/screen-requirements-public.md A11)。
 *
 * **未ログインから呼ぶ唯一のcallableである。** 送信の可否・スパム対策・宛先はすべてサーバー側で
 * 決まり(`src/backend/src/contact/functions.ts`)、ここが持つのは呼び出しと失敗理由の
 * 読み替えだけ。認証を通らないため`signed-out`は返らない。
 */

/** バックエンドの`details.reason`として受け付ける値(src/backend/src/contact/functions.ts) */
const CONTACT_FAILURE_REASONS: readonly ContactFailureReason[] = [
  "throttled",
  "send-failed",
  "not-configured",
];

/**
 * 入力不正だけは`details.reason`が載らない。
 *
 * バックエンドはzodの検証に落ちた時点で`invalid-argument`を投げ、どの項目かは返さない
 * (返すと、UIを通さない送信に手がかりを与えることになる)。画面側でも同じ制限をかけて
 * いるため通常は起きないが、`unknown`に丸めると「時間をおいて再試行」という的外れな
 * 案内になるため、コードから読み替える。
 */
const INVALID_ARGUMENT_CODE = "functions/invalid-argument";

/**
 * 問い合わせを1件送る。
 *
 * ハニーポット(`website`)の値はそのまま渡す。**画面では判定しない** — 弾かれたことが
 * 送信側に分かると、何が検知されたのかを試行錯誤で特定できてしまうため、扱いはサーバー側に
 * 委ねる(サーバーは成功として返す)。
 */
export const sendContactMessage = async (values: ContactFormValues): Promise<ContactResult> => {
  try {
    const callable = httpsCallable(getFirebaseFunctions(), SEND_CONTACT_MESSAGE_FUNCTION);
    await callable(values);

    return { ok: true };
  } catch (error) {
    if (hasCode(error, INVALID_ARGUMENT_CODE)) {
      console.error("お問い合わせを送信できませんでした", INVALID_ARGUMENT_CODE);
      return { ok: false, reason: "invalid-argument" };
    }

    return {
      ok: false,
      reason: toCallableFailureReason(
        error,
        CONTACT_FAILURE_REASONS,
        "お問い合わせを送信できませんでした",
      ),
    };
  }
};

/** callableのエラーコードが`code`か。SDKの`FunctionsError`に`instanceof`で依存しない */
const hasCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
