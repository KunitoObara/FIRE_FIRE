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
 * SDK 側は `' : '` で分解したうえで `BLOCKING_FUNCTION_ERROR_RESPONSE` を
 * `auth/internal-error` に写し、コロンより後ろをそのままエラーメッセージとして残す
 * (`@firebase/auth` の `errorMap` と `_errorWithCustomMessage`)。
 *
 * **つまりコードは常に `auth/internal-error` で、理由はメッセージ側にしか無い。**
 * 上の形は `fire-fire-dev` へデプロイした実物のレスポンスで確認したものである。
 */

/** Blocking Function の拒否であることを示す、Identity Platform 側のエラーコード */
const BLOCKING_FUNCTION_ERROR = "BLOCKING_FUNCTION_ERROR_RESPONSE";

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

  // 包んだ形が変わっている場合(SDKやIdentity Platform側の変更)は、無理に読まず`null`を返す。
  // 「拒否ではない何か」として扱われ、既存の`unknown`の文言が出る
  if (!error.message.includes(BLOCKING_FUNCTION_ERROR)) {
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
