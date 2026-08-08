import { format } from "date-fns";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { STORED_DATE_FORMAT } from "@/constants/csv-import";
import { DEBT_BALANCE_HISTORY_MAX } from "@/constants/debts";
import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { debtDocumentSchema } from "@/schemas/debts";

import type { Firestore } from "firebase/firestore";

/**
 * 負債のFirestore入出力(B11 負債入力画面)。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 読み書きともクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/debts/{debtId}   ユーザーが登録した負債(残債の履歴を同ドキュメント内に持つ)
 * ```
 */

const DEBTS_COLLECTION = "debts";
const USERS_COLLECTION = "users";

const debtsRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, DEBTS_COLLECTION);

/** ドキュメントを画面が使う形に変換する。解釈できなければ`undefined`を返す */
const toDebt = (id: string, data: unknown): Debt | undefined => {
  const parsed = debtDocumentSchema.safeParse(data);

  if (!parsed.success) {
    console.error("負債を解釈できませんでした", id, parsed.error.issues);
    return undefined;
  }

  // `createdAt`は一覧の並び順にしか使わないため画面へは渡さない(B11に登録日時の表示は無い)
  return {
    id,
    name: parsed.data.name,
    balance: parsed.data.balance,
    interestRate: parsed.data.interestRate,
    repaymentMonths: parsed.data.repaymentMonths,
    updatedAt: parsed.data.updatedAt,
    balanceHistory: parsed.data.balanceHistory,
  };
};

/**
 * 登録済みの負債を登録順(古い順)に取得する。
 *
 * B11のフォームの並び順そのものになる。金額順や更新日順にすると、残債を更新するたびに
 * 編集中の行の位置が変わるため、登録順に固定する(B5の物件一覧と同じ扱い)。
 * B1の負債サマリだけは「いま何をどれだけ返済中か」を見る表示なので、受け取ってから
 * 残債の多い順に並べ替える(`src/lib/debts/summary.ts`)。
 *
 * 解釈できないドキュメントは一覧ごと落とさず、その1件だけを飛ばす。
 */
export const fetchDebts = async (): Promise<DebtsResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(debtsRef(context.firestore, context.uid), orderBy("createdAt", "asc")),
    );

    const debts = snapshot.docs.flatMap((document) => {
      const debt = toDebt(document.id, document.data());

      return debt === undefined ? [] : [debt];
    });

    return { ok: true, debts };
  } catch (error) {
    console.error("負債を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 保存する残債の履歴を組み立てる。
 *
 * **残債が前回と変わった負債についてのみ、その日の残債を記録する**
 * (docs/screen-requirements-dashboard.md B11「残債の履歴」)。変わっていない保存で記録を
 * 増やしても同じ値の点が並ぶだけで、推移の描画結果は変わらない。
 *
 * キーが日付なので、同じ日に複数回保存すればその日の記録が上書きされる
 * (CSV取込が同じ日付を上書きするのと同じ冪等な扱い)。
 */
const buildNextBalanceHistory = (
  current: DebtBalanceHistory,
  previousBalance: number | undefined,
  balance: number,
  today: string,
): DebtBalanceHistory => (previousBalance === balance ? current : { ...current, [today]: balance });

/**
 * 画面全体の負債を一括保存する(B11の「保存」)。
 *
 * 行ごとに保存せず`writeBatch`で1回にまとめる。負債は複数まとめて見直すことが多く、
 * 行単位の保存だと途中まで保存された状態が残るため(B11「追加・削除と保存」)。
 * 途中で失敗した場合は何も書き込まれず、画面の入力値はそのまま残る。
 *
 * 削除は「保存済みの負債のうち、渡された行に含まれないもの」として求める。画面上の
 * 「削除」は行を減らすだけで、確定するのはこの保存の時点になる。
 *
 * 保存直前に現在の負債を読み直すのは、残債が前回と変わったかの判定と、追記先の履歴が
 * 必要なため。画面が読み込んだ時点の値を持ち回すと、別のタブで更新された履歴を
 * 巻き戻して書くことになる。
 */
export const saveDebts = async (inputs: DebtInput[]): Promise<SaveDebtsResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  const collectionRef = debtsRef(context.firestore, context.uid);

  try {
    const snapshot = await getDocs(collectionRef);
    const stored = new Map(
      snapshot.docs.flatMap((document) => {
        const debt = toDebt(document.id, document.data());

        return debt === undefined ? [] : [[document.id, debt] as const];
      }),
    );

    const today = format(new Date(), STORED_DATE_FORMAT);
    const batch = writeBatch(context.firestore);
    const keptIds = new Set<string>();

    for (const input of inputs) {
      // 保存済みのIDが手元に無い場合(別のタブで削除された等)は新規として採番し直す。
      // `updateDoc`は存在しないドキュメントに対して失敗するため、保存全体が落ちる
      const existing = input.id === null ? undefined : stored.get(input.id);
      const fields = {
        name: input.name,
        balance: input.balance,
        interestRate: input.interestRate,
        repaymentMonths: input.repaymentMonths,
        // 最終更新日は入力項目ではなく保存時に自動で付ける(B7の時価・ローン残高と同じ扱い)。
        // 端末の日付を使う理由もB7と同じで、`serverTimestamp()`だと書き込み直後に
        // 値が確定せず、保存した直後だけ最終更新日が空になる
        updatedAt: today,
        balanceHistory: buildNextBalanceHistory(
          existing?.balanceHistory ?? {},
          existing?.balance,
          input.balance,
          today,
        ),
      };

      if (Object.keys(fields.balanceHistory).length > DEBT_BALANCE_HISTORY_MAX) {
        // 古い記録から捨てる案は採らない。過去の資産推移グラフの値が、負債を更新しただけで
        // 黙って変わることになるため(B11「残債の履歴」)。到達しない前提の歯止め
        return { ok: false, reason: "history-limit-exceeded" };
      }

      if (existing === undefined) {
        // `addDoc`は使えない(バッチに載せられない)ので、IDだけ先に採番して`set`する
        batch.set(doc(collectionRef), { ...fields, createdAt: serverTimestamp() });
      } else {
        keptIds.add(existing.id);
        // 登録順が編集のたびに入れ替わらないよう`createdAt`は更新しない
        // (`categoryAxes`・`properties`と同じ扱いで、`firestore.rules`側でも拒否する)
        batch.update(doc(collectionRef, existing.id), fields);
      }
    }

    for (const id of stored.keys()) {
      if (!keptIds.has(id)) {
        // 負債を削除すると残債の履歴も一緒に消える。資産推移グラフからその負債の控除が
        // 過去に遡って消えることは、保存前の確認ダイアログで明示している(B11)
        batch.delete(doc(collectionRef, id));
      }
    }

    await batch.commit();

    return { ok: true };
  } catch (error) {
    console.error("負債を保存できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
