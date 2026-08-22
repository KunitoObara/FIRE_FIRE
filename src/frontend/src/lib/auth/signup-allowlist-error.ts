import { FirebaseError } from "firebase/app";

/**
 * サインアップ制限(招待制)による拒否かどうかの判定
 * (docs/auth-login-requirements.md 3.10「エラーの伝わり方」)。
 *
 * バックエンドの Blocking Function(`beforeUserCreated`)が投げた `HttpsError` は、
 * クライアントSDKには**カスタムメッセージのままでは届かない**。Identity Platform が
 * サーバーのエラーメッセージを次の形に包み、
 *
 * ```
 * BLOCKING_FUNCTION_ERROR_RESPONSE : HTTP Cloud Function returned an error: {"error":{"message":"…","status":"PERMISSION_DENIED"}}
 * ```
 *
 * SDK 側は `' : '` で分解して `BLOCKING_FUNCTION_ERROR_RESPONSE` を `auth/internal-error`
 * に写し、**コロンより後ろだけ**をエラーメッセージとして残す(`@firebase/auth` の
 * `errorMap` と `_errorWithCustomMessage`)。
 *
 * **`BLOCKING_FUNCTION_ERROR_RESPONSE` という文字列自体は `error.message` に残らない。**
 * SDKにとってあれはエラーマップの**キー**でしかなく、投げられる `FirebaseError` の
 * メッセージになるのは分割後の後半だけである(`_performFetchWithErrorHandling`)。
 * ここを前置きの文字列で判定していたために、実際には拒否されているのに判定が常に外れ、
 * 汎用の「不明なエラー」の文言が出ていた([A1](https://trello.com/c/idgZRaS3))。
 * 判定材料に使ってよいのは**分割後の後半に残るもの**、すなわち `status` を含むJSONだけである。
 *
 * **つまりコードは常に `auth/internal-error` で、理由はメッセージ側にしか無い。**
 */

/**
 * 拒否の理由。バックエンドが投げた `HttpsError` のステータスに対応する
 * (`src/backend/src/signup-allowlist/functions.ts`)。
 */
export type SignUpBlockedReason =
  /** 許可リストに無いメールアドレス。`HttpsError("permission-denied", …)` */
  | "not-allowed"
  /** 許可リストを読み取れなかった(fail-closed)。`HttpsError("internal", …)` */
  | "unavailable";

/**
 * サインアップ制限による拒否なら理由を、そうでなければ `null` を返す。
 *
 * **メッセージ本文(日本語の文言)では判定しない。** 文言はバックエンド側の都合でいつでも
 * 変わりうるうえ、変えたときに黙って判定が外れる。ステータスは `HttpsError` の第1引数に
 * 対応する機械的な値なので、文言より寿命が長い。
 *
 * **判定に使う文字列は `status` を含むJSONだけに絞る。** `"status":"…"` というJSONの形自体が
 * Identity Platform が包んだ証拠になるため、これとは別に「包みであること」を示すマーカーを
 * 併せて見る必要が無い。マーカーを増やせばそのぶん、SDKやIdentity Platformが表現を変えたときに
 * **黙って判定が外れる経路**が増える(実際に外れていたのが上の前置き判定である)。
 * 包み方が変わって `status` を読めなくなった場合は `null` を返し、既存の「不明なエラー」の
 * 文言に落ちる。取り違えて「招待されていません」を出すより害が小さい。
 *
 * **`PERMISSION_DENIED` を「未承認」と読んでよい根拠**は、Identity Platform が
 * `beforeCreate` のブロッキング関数を**プロジェクトに1つしか登録できない**ことにある。
 * アカウント作成の経路でこのエラーを出しうるのは `restrictSignUpToAllowlist` だけで、
 * 他の関数と取り違える余地が無い。2つ目の `beforeCreate` を足すことになったら、
 * ここは機械可読なマーカーでの判定に切り替える必要がある。
 */
export const detectSignUpBlockedReason = (error: unknown): SignUpBlockedReason | null => {
  if (!(error instanceof FirebaseError) || error.code !== "auth/internal-error") {
    return null;
  }

  if (error.message.includes('"status":"PERMISSION_DENIED"')) {
    return "not-allowed";
  }

  if (error.message.includes('"status":"INTERNAL"')) {
    return "unavailable";
  }

  return null;
};
