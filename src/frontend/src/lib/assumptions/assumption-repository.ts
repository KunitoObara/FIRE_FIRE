import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { assetAssumptionSchema, assumptionsDocumentSchema } from "@/schemas/assumptions";

import type { Firestore } from "firebase/firestore";

/**
 * 想定利回り・リスクのFirestore入出力(B9 想定利回り・リスク設定画面)。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 読み書きともクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/settings/assumptions   想定利回り・リスク(ユーザーごとに1件)
 * ```
 *
 * 資産種別ごとに1ドキュメントにはしない。資産種別名はCSVの列名そのもので、`/`のように
 * FirestoreのドキュメントIDに使えない文字が混じりうるうえ、画面は常に全件をまとめて
 * 読み書きするため。1件のドキュメントに資産種別名をキーにしたマップとして持たせる。
 */

const SETTINGS_COLLECTION = "settings";
const USERS_COLLECTION = "users";

/** 想定利回り・リスクのドキュメントID。ユーザーごとに1件なので固定名にする */
const ASSUMPTIONS_DOCUMENT_ID = "assumptions";

const assumptionsRef = (firestore: Firestore, uid: string) =>
  doc(firestore, USERS_COLLECTION, uid, SETTINGS_COLLECTION, ASSUMPTIONS_DOCUMENT_ID);

/**
 * 保存済みの想定利回り・リスクを取得する。まだ設定していなければ空のレコードを返す。
 *
 * 解釈できない資産種別はその1件だけを飛ばし、他の資産種別の設定は返す(取込履歴と同じ扱い)。
 * 1件の不整合で画面上の設定がすべて空になると、保存し直した時にその全部を消してしまう。
 */
export const fetchAssumptions = async (): Promise<AssumptionsResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDoc(assumptionsRef(context.firestore, context.uid));

    if (!snapshot.exists()) {
      return { ok: true, assumptions: {} };
    }

    const parsed = assumptionsDocumentSchema.safeParse(snapshot.data());

    if (!parsed.success) {
      console.error("想定利回り・リスクを解釈できませんでした", parsed.error.issues);
      return { ok: true, assumptions: {} };
    }

    const assumptions: AssetAssumptions = {};

    for (const [assetTypeName, entry] of Object.entries(parsed.data.entries)) {
      const parsedEntry = assetAssumptionSchema.safeParse(entry);

      if (!parsedEntry.success) {
        console.error("資産種別の想定値を解釈できませんでした", assetTypeName);
        continue;
      }

      assumptions[assetTypeName] = parsedEntry.data;
    }

    return { ok: true, assumptions };
  } catch (error) {
    console.error("想定利回り・リスクを取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 想定利回り・リスクを保存する。初回・2回目以降とも同じ書き込みで済ませる。
 *
 * `merge`せずドキュメントを丸ごと置き換える。画面が全件をまとめて編集するため差分更新に
 * する理由が無く、`merge`にすると空欄に戻したはずの欄が前回の値のまま残りうるため
 * (FIRE目標と同じ扱い)。一覧に出ていない資産種別の設定を消さないための引き継ぎは、
 * 呼び出し側が渡す`assumptions`の組み立て時に行う(`src/lib/assumptions/form-values.ts`)。
 */
export const saveAssumptions = async (
  assumptions: AssetAssumptions,
): Promise<SaveAssumptionsResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    await setDoc(assumptionsRef(context.firestore, context.uid), {
      entries: assumptions,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (error) {
    console.error("想定利回り・リスクを保存できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
