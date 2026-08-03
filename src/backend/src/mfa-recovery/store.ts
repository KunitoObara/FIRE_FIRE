import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { matchesRecoveryCodeHash } from "./recovery-code";

import type { RecoveryCodeHash } from "./recovery-code";

/**
 * 2FAリカバリーコードの保存(docs/auth-login-requirements.md 3.3)。
 *
 * クライアントからの読み書きは`firestore.rules`で全面的に拒否しており、
 * この領域に触れるのはAdmin SDKを使うCloud Functionsだけ。平文のコードは保存しない。
 */

/** 保存先コレクション。ドキュメントIDはユーザーのuid(1ユーザー1件) */
const RECOVERY_CODES_COLLECTION = "mfaRecoveryCodes";

/**
 * 保存済みドキュメントのスキーマ。
 *
 * Firestoreから読んだ値は型の保証が無いため、`unknown`として受けてからzodで確定させる
 * (src/backend/docs/TECH_STACK.md 5章)。想定外の形なら「コードが無い」として扱い、
 * 中身を推測して照合を続けない。
 */
const storedRecoveryCodeSchema = z.object({
  salt: z.string().min(1),
  hash: z.string().min(1),
  /** 使用済みなら使用日時。未使用は`null`。使用済みコードは以後の照合対象から外す */
  usedAt: z.instanceof(Timestamp).nullable(),
});

const recoveryCodeDocumentSchema = z.object({
  codes: z.array(storedRecoveryCodeSchema),
  generatedAt: z.instanceof(Timestamp),
});

type StoredRecoveryCode = z.infer<typeof storedRecoveryCodeSchema>;

/**
 * 発行状況(B10の表示用)。
 *
 * 平文もハッシュも返さず、本数と発行日時だけを返す。クライアントは
 * `firestore.rules`でこの領域を読めないため、表示に要る情報はここを通して渡す。
 */
export type RecoveryCodeStatus = {
  /** 未発行なら`null`。それ以外はエポックミリ秒(callableの応答に載せるためDateにしない) */
  generatedAt: number | null;
  /** 未使用のコードの本数 */
  remainingCodes: number;
  /** 発行済みのコードの総数 */
  totalCodes: number;
};

/** リカバリーコードでの照合結果 */
export type ConsumeRecoveryCodeResult =
  /** 一致した。`remainingCodes`はこの1本を消費したあとの未使用本数 */
  | { status: "consumed"; remainingCodes: number }
  /** 未使用のコードが1本も無い(発行前・全消費済み) */
  | { status: "no-codes" }
  /** 未使用のコードのどれとも一致しなかった */
  | { status: "no-match" };

const recoveryCodesDocument = (uid: string) =>
  getFirestore().collection(RECOVERY_CODES_COLLECTION).doc(uid);

/**
 * 発行したコード一式を保存する(A3の登録完了時・B10の再発行時)。
 *
 * 既存のコードは上書きして捨てる。再発行の目的は「今までのコードを無効にして作り直す」ことなので、
 * 追記にはしない。
 */
export const replaceRecoveryCodes = async (
  uid: string,
  hashes: RecoveryCodeHash[],
): Promise<void> => {
  const codes: StoredRecoveryCode[] = hashes.map((hash) => ({ ...hash, usedAt: null }));

  await recoveryCodesDocument(uid).set({
    codes,
    generatedAt: Timestamp.now(),
  });
};

/**
 * 発行状況を読み出す(B10の表示用)。
 *
 * 未発行・保存内容が想定外の形の場合は「0本」として返す。ここで例外にしても画面側は
 * 再発行を促すしかなく、扱いが変わらないため。
 */
export const getRecoveryCodeStatus = async (uid: string): Promise<RecoveryCodeStatus> => {
  const snapshot = await recoveryCodesDocument(uid).get();
  const parsed = recoveryCodeDocumentSchema.safeParse(snapshot.data());

  if (!parsed.success) {
    return { generatedAt: null, remainingCodes: 0, totalCodes: 0 };
  }

  const { codes, generatedAt } = parsed.data;

  return {
    generatedAt: generatedAt.toMillis(),
    remainingCodes: codes.filter((code) => code.usedAt === null).length,
    totalCodes: codes.length,
  };
};

/**
 * 保存済みのコードを丸ごと捨てる(2FAの解除時)。
 *
 * リカバリーコードは2FA(TOTP)を失ったときの復旧手段なので、その2FAの登録が無くなれば
 * 使い道が無い(`useMfaRecoveryCode`は2FA登録済みであることを要求する)。残しておくと、
 * 次の登録(A3)の発行が「再発行」と区別できなくなり、本人確認の要否を誤判定する
 * (`functions.ts`の`hasLiveRecoveryCodes`)。
 */
export const deleteRecoveryCodes = async (uid: string): Promise<void> => {
  await recoveryCodesDocument(uid).delete();
};

/**
 * 入力されたコードを照合し、一致したら使用済みにする(A5のリカバリーコード検証)。
 *
 * 「照合 → 使用済みに更新」をトランザクションで囲む。同じコードで同時に2回呼ばれたときに
 * 両方が有効と判定されると、1回限りという前提が崩れるため。
 */
export const consumeRecoveryCode = async (
  uid: string,
  normalizedCode: string,
): Promise<ConsumeRecoveryCodeResult> => {
  const document = recoveryCodesDocument(uid);

  return getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    const parsed = recoveryCodeDocumentSchema.safeParse(snapshot.data());

    if (!parsed.success) {
      return { status: "no-codes" };
    }

    const { codes } = parsed.data;
    const unusedIndexes = codes
      .map((code, index) => ({ code, index }))
      .filter(({ code }) => code.usedAt === null)
      .map(({ index }) => index);

    if (unusedIndexes.length === 0) {
      return { status: "no-codes" };
    }

    // どのコードと一致するかは分からないため、未使用のものを順に照合する。
    // 1本あたりscrypt 1回のコストがかかるが、リカバリーコードを使う場面は稀なため許容する。
    // 一致した時点で残りは照合しないので、並列化せず直列に回す
    for (const index of unusedIndexes) {
      if (await matchesRecoveryCodeHash(normalizedCode, codes[index])) {
        const updatedCodes = codes.map((code, codeIndex) =>
          codeIndex === index ? { ...code, usedAt: Timestamp.now() } : code,
        );
        transaction.update(document, { codes: updatedCodes });

        return { status: "consumed", remainingCodes: unusedIndexes.length - 1 };
      }
    }

    return { status: "no-match" };
  });
};
