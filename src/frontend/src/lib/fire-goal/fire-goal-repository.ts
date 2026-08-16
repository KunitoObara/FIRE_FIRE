import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { fireGoalDocumentSchema } from "@/schemas/fire-goal";

import type { Firestore } from "firebase/firestore";

/**
 * FIRE目標のFirestore入出力(B8 FIRE目標設定画面)。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 読み書きともクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/settings/fireGoal   FIRE目標(ユーザーごとに1件)
 * ```
 *
 * 1件しか無い設定をコレクションに置くのは、Firestoreにドキュメント直下の
 * サブドキュメントという概念が無いため。`settings`配下にすることで、B9の想定利回りなど
 * 後続の設定も同じ場所に並べられる。
 */

const SETTINGS_COLLECTION = "settings";
const USERS_COLLECTION = "users";

/** FIRE目標のドキュメントID。ユーザーごとに1件なので固定名にする */
const FIRE_GOAL_DOCUMENT_ID = "fireGoal";

const fireGoalRef = (firestore: Firestore, uid: string) =>
  doc(firestore, USERS_COLLECTION, uid, SETTINGS_COLLECTION, FIRE_GOAL_DOCUMENT_ID);

/**
 * 保存済みのFIRE目標を取得する。まだ設定していなければ`goal: null`を返す。
 *
 * 解釈できないドキュメントも`goal: null`に倒す。「未設定」として既定値のフォームを出す方が、
 * 目標を設定できないまま行き止まりになるより先に進めるため。
 */
export const fetchFireGoal = async (): Promise<FireGoalResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDoc(fireGoalRef(context.firestore, context.uid));

    if (!snapshot.exists()) {
      return { ok: true, goal: null };
    }

    const parsed = fireGoalDocumentSchema.safeParse(snapshot.data());

    if (!parsed.success) {
      console.error("FIRE目標を解釈できませんでした", parsed.error.issues);
      return { ok: true, goal: null };
    }

    return {
      ok: true,
      goal: {
        mode: parsed.data.mode,
        targetAmount: parsed.data.targetAmount,
        annualExpense: parsed.data.annualExpense,
        withdrawalRate: parsed.data.withdrawalRate,
        // 対象分類を持たずに保存された既存の目標はキーごと無い。既定(総資産)として扱い、
        // これまでと同じ現在資産額・達成率のままにする(要件B1)
        achievementAxisId: parsed.data.achievementAxisId ?? null,
        // 積立額を導入する前に保存された目標も同じくキーごと無い。値なしとして扱い、
        // 画面側が前月の収支を初期値に提示する(要件B8「毎月の積立額」)
        monthlyContribution: parsed.data.monthlyContribution ?? null,
      },
    };
  } catch (error) {
    console.error("FIRE目標を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * FIRE目標を保存する。初回・2回目以降とも同じ書き込みで済ませる。
 *
 * `merge`せずドキュメントを丸ごと置き換える。両方式の入力値を常にすべて書くため差分更新に
 * する理由が無く、`merge`にすると消したはずの欄が前回の値のまま残りうるため。
 */
export const saveFireGoal = async (goal: FireGoal): Promise<SaveFireGoalResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    await setDoc(fireGoalRef(context.firestore, context.uid), {
      mode: goal.mode,
      targetAmount: goal.targetAmount,
      annualExpense: goal.annualExpense,
      withdrawalRate: goal.withdrawalRate,
      // 既定(総資産)も`null`として明示的に書く。キーを省くと、既定を選び直したのか
      // 対象分類を導入する前に保存された目標なのかが読み出し側で区別できなくなる
      achievementAxisId: goal.achievementAxisId,
      // B8からの保存では常に数値(未入力は0)が入る。キーを省かないのは、積立なしを選んだのか
      // 積立額を導入する前に保存された目標なのかを読み出し側で区別するため(対象分類と同じ扱い)
      monthlyContribution: goal.monthlyContribution,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  } catch (error) {
    console.error("FIRE目標を保存できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
