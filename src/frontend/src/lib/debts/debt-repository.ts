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
 *
 * `saveDebts`はFirestoreに触るためテストから直接は動かせないので、履歴の組み立てだけを
 * exportして単体で確かめられるようにしてある。ここを誤ると資産推移グラフが過去に遡って
 * 別の値を描く。
 */
export const buildNextBalanceHistory = (
  current: DebtBalanceHistory,
  previousBalance: number | undefined,
  balance: number,
  today: string,
): DebtBalanceHistory => (previousBalance === balance ? current : { ...current, [today]: balance });

/**
 * 今回の保存で削除する負債のIDを求める。
 *
 * **基準は`baselineIds`(画面が読み込んだ時点のID)で、サーバーの最新状態ではない。**
 * 最新状態を基準にすると、画面が存在を知らない負債(別のタブで追加されたもの)まで
 * 削除対象に入る(`saveDebts`の説明を参照)。
 *
 * Firestoreに触らない判断だけを切り出してある。ここが誤ると資産推移グラフから
 * 負債の控除が過去に遡って消えるため、リポジトリの外から直接確かめられるようにしておく。
 */
export const resolveDeletedDebtIds = (baselineIds: string[], inputs: DebtInput[]): string[] => {
  const keptIds = new Set(inputs.flatMap((input) => (input.id === null ? [] : [input.id])));

  return baselineIds.filter((id) => !keptIds.has(id));
};

/**
 * 画面全体の負債を一括保存する(B11の「保存」)。
 *
 * 行ごとに保存せず`writeBatch`で1回にまとめる。負債は複数まとめて見直すことが多く、
 * 行単位の保存だと途中まで保存された状態が残るため(B11「追加・削除と保存」)。
 * 途中で失敗した場合は何も書き込まれず、画面の入力値はそのまま残る。
 *
 * 保存直前に現在の負債を読み直すのは、残債が前回と変わったかの判定と、追記先の履歴が
 * 必要なため。画面が読み込んだ時点の値を持ち回すと、別のタブで更新された履歴を
 * 巻き戻して書くことになる。
 *
 * **削除対象は`baselineIds`(画面が読み込んだ時点のID)を基準に求める。** 読み直した
 * サーバー側の一覧を基準にすると、**画面が存在を知らない負債まで削除してしまう**。
 * 同じアカウントを2つのタブで開き、片方で負債を追加したあと、もう片方(古いフォーム状態の
 * まま)で保存すると、追加したはずの負債が消える。単一ユーザー前提のアプリだが、
 * だからこそPCとスマートフォンの両方から開く運用は普通に起こる。
 *
 * 基準を分けた結果、次の3つが意図どおりに揃う。
 *
 * - `baselineIds`にあって`inputs`に無い → 画面上で削除された。消す
 * - `baselineIds`に無い(=別のタブで追加された) → 触らない
 * - `inputs`にあって`stored`に無い(=別のタブで削除された) → 新規として採番し直す
 *
 * 保存前の確認ダイアログが出す削除対象も同じ`baselineIds`側から組み立てているので
 * (`buildDebtDeletionPreviews`)、ダイアログに出した負債とここで消える負債が一致する。
 */
export const saveDebts = async (
  inputs: DebtInput[],
  baselineIds: string[],
): Promise<SaveDebtsResult> => {
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
    /*
      保存後の負債を組み立てて返す。画面が追加した行はここで初めてIDが決まるため、
      これを返さないとフォームの行が`id: null`のまま残り、次の保存で同じ負債が
      「削除して作り直し」に化けて残債の履歴が消える。
      並びは`fetchDebts`(登録順)と一致する — 既存の行は元の順のまま、追加した行は
      `createdAt`が今なので末尾に来る。`inputs`の並びがそのままそれを表している
    */
    const saved: Debt[] = [];

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
        const reference = doc(collectionRef);

        batch.set(reference, { ...fields, createdAt: serverTimestamp() });
        saved.push({ id: reference.id, ...fields });
      } else {
        // 登録順が編集のたびに入れ替わらないよう`createdAt`は更新しない
        // (`categoryAxes`・`properties`と同じ扱いで、`firestore.rules`側でも拒否する)
        batch.update(doc(collectionRef, existing.id), fields);
        saved.push({ id: existing.id, ...fields });
      }
    }

    // 負債を削除すると残債の履歴も一緒に消える。資産推移グラフからその負債の控除が
    // 過去に遡って消えることは、保存前の確認ダイアログで明示している(B11)。
    // 既に消えているIDへの`delete`は無害なので、`stored`との突き合わせはしない
    for (const id of resolveDeletedDebtIds(baselineIds, inputs)) {
      batch.delete(doc(collectionRef, id));
    }

    await batch.commit();

    return { ok: true, debts: saved };
  } catch (error) {
    console.error("負債を保存できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
