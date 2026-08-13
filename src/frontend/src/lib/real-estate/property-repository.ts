import { format } from "date-fns";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { STORED_DATE_FORMAT } from "@/constants/csv-import";
import { REAL_ESTATE_VALUE_HISTORY_MAX } from "@/constants/real-estate";
import { resolveFirestoreUserContext, toFirestoreFailureReason } from "@/lib/firebase/user-context";
import { realEstatePropertyDocumentSchema } from "@/schemas/real-estate";

import type { Firestore } from "firebase/firestore";

/**
 * 物件のFirestore入出力(B5 一覧・B6 詳細・B7 登録/編集)。
 *
 * 認証はブラウザ側のFirebase SDKが持っており、サーバー側からは`uid`を特定できないため、
 * 読み書きともクライアントSDKから直接行う。他人のデータに触れないことは`firestore.rules`の
 * ユーザー単位の判定で担保する(docs/fire-asset-management-requirements.md 5章)。
 *
 * ```
 * users/{uid}/properties/{propertyId}   ユーザーが登録した物件
 * ```
 */

const PROPERTIES_COLLECTION = "properties";
const USERS_COLLECTION = "users";

const propertiesRef = (firestore: Firestore, uid: string) =>
  collection(firestore, USERS_COLLECTION, uid, PROPERTIES_COLLECTION);

/**
 * ドキュメントを画面が使う形に変換する。解釈できなければ`undefined`を返す。
 *
 * `rental`はFirestore上では`null`(収益物件でない)を明示的に持つが、画面側の
 * `RealEstateProperty`ではキーごと省く。「賃貸収支を表示しない」という判定を
 * `rental === undefined`の1つに揃えるため(`src/types/real-estate.d.ts`)。
 */
const toRealEstateProperty = (id: string, data: unknown): RealEstateProperty | undefined => {
  const parsed = realEstatePropertyDocumentSchema.safeParse(data);

  if (!parsed.success) {
    console.error("物件を解釈できませんでした", id, parsed.error.issues);
    return undefined;
  }

  const property: RealEstateProperty = {
    id,
    name: parsed.data.name,
    location: parsed.data.location,
    acquiredOn: parsed.data.acquiredOn,
    marketValue: parsed.data.marketValue,
    loanBalance: parsed.data.loanBalance,
    updatedAt: parsed.data.updatedAt,
    valueHistory: parsed.data.valueHistory,
  };

  // `createdAt`は一覧の並び順にしか使わないため画面へは渡さない(B5〜B7に登録日時の表示は無い)
  return parsed.data.rental === null ? property : { ...property, rental: parsed.data.rental };
};

/**
 * 保存する値を組み立てる。
 *
 * 最終更新日は入力項目ではなく保存時に自動で更新する
 * (docs/screen-requirements-real-estate.md B7)。時価もローン残高も手動更新であり、
 * 「いつ時点の値か」はB6で利ざやの信頼度を判断する材料になるため必ず更新する。
 *
 * サーバー時刻(`serverTimestamp()`)ではなく端末の日付を使う。B6が表示するのは日付だけで
 * 時刻の精度を必要とせず、書き込み直後に値が確定しない`serverTimestamp()`を最終更新日に
 * 使うと、保存してB6に戻った直後だけ日付が空になるため(B2が資産残高の集計日を
 * `yyyy-MM-dd`で持っているのと同じ扱い)。
 */
const toDocumentFields = (input: RealEstatePropertyInput, today: string) => ({
  name: input.name,
  location: input.location,
  // 未登録は`null`で書く。`firestore.rules`は許可キーと必須キーの両方で見ているので、
  // 未入力でもキー自体は必ず書き込む(B11の`originatedOn`と同じ扱い)
  acquiredOn: input.acquiredOn,
  marketValue: input.marketValue,
  loanBalance: input.loanBalance,
  rental: input.rental,
  updatedAt: today,
});

/**
 * その日の記録を履歴に積むかどうか。
 *
 * **時価かローン残高が前回と変わった物件についてのみ記録する**
 * (docs/screen-requirements-real-estate.md B7「時価・ローン残高の履歴」)。変わっていない
 * 保存で記録を増やしても同じ値の点が並ぶだけで、推移の描画結果は変わらない。
 *
 * **履歴を1件も持っていない物件は、値が変わっていなくても積む。** 2つの理由がある。
 * B4-8より前に登録された物件は履歴を持たず、比べる相手の「前回の記録」がそもそも無い。
 * かつ`firestore.rules`の`isValidProperty()`が`valueHistory`を必須キーで見るため、
 * ここで積まないと既存の物件を編集しただけで保存が拒否される。
 *
 * Firestoreに触る前の判断だけを切り出してある。ここを誤ると資産推移グラフが過去に遡って
 * 別の値を描くため、リポジトリの外から直接確かめられるようにしておく
 * (B11の`buildNextBalanceHistory`と同じ理由)。
 */
export const shouldRecordValueHistory = (
  existing: RealEstateProperty | undefined,
  input: RealEstatePropertyInput,
): boolean =>
  existing === undefined ||
  Object.keys(existing.valueHistory).length === 0 ||
  existing.marketValue !== input.marketValue ||
  existing.loanBalance !== input.loanBalance;

/**
 * 記録を1件積んだあとの履歴の件数。上限の判定に使う。
 *
 * **同じ日に2回目の保存をしても増えない。** キーが日付なので、その日の記録は上書きになる
 * (CSV取込が同じ日付を上書きするのと同じ冪等な扱い)。
 */
export const resolveNextValueHistoryCount = (
  history: RealEstateValueHistory,
  today: string,
): number => Object.keys(history).length + (today in history ? 0 : 1);

/**
 * 登録済みの物件を登録順(古い順)に取得する(B5の表示項目)。
 *
 * 並び替えの指定は要件に無いため登録順に固定する。金額順や更新日順にすると、
 * 時価を更新するたびに一覧での位置が変わり、目当ての物件を探しにくくなる。
 *
 * 解釈できないドキュメントは一覧ごと落とさず、その1件だけを飛ばす
 * (`fetchImportHistory`と同じ考え方)。
 */
export const fetchRealEstateProperties = async (): Promise<RealEstatePropertiesResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDocs(
      query(propertiesRef(context.firestore, context.uid), orderBy("createdAt", "asc")),
    );

    const properties = snapshot.docs.flatMap((document) => {
      const property = toRealEstateProperty(document.id, document.data());

      return property === undefined ? [] : [property];
    });

    return { ok: true, properties };
  } catch (error) {
    console.error("物件を取得できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 物件1件を取得する(B6 詳細・B7 編集モード)。
 *
 * 存在しない物件・解釈できない物件はどちらも`property: null`で返す。削除済みの物件を
 * ブックマークから開いた場合と同じ扱いにして、画面には「物件が見つかりません」を出させる。
 */
export const fetchRealEstateProperty = async (id: string): Promise<RealEstatePropertyResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const snapshot = await getDoc(doc(propertiesRef(context.firestore, context.uid), id));

    if (!snapshot.exists()) {
      return { ok: true, property: null };
    }

    return { ok: true, property: toRealEstateProperty(snapshot.id, snapshot.data()) ?? null };
  } catch (error) {
    console.error("物件を取得できませんでした", id, error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 物件を新規登録する。保存後の遷移先(B6)を組み立てられるよう、採番されたIDを返す。
 */
export const createRealEstateProperty = async (
  input: RealEstatePropertyInput,
): Promise<SaveRealEstatePropertyResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const today = format(new Date(), STORED_DATE_FORMAT);
    const reference = await addDoc(propertiesRef(context.firestore, context.uid), {
      ...toDocumentFields(input, today),
      // 新規登録は必ず1件目の記録を積む。比べる相手が無いうえ、履歴が空のままだと
      // 資産推移グラフが起点を決められず、取得年月を入れていない物件がどこにも積まれない
      valueHistory: { [today]: { marketValue: input.marketValue, loanBalance: input.loanBalance } },
      createdAt: serverTimestamp(),
    });

    return { ok: true, id: reference.id };
  } catch (error) {
    console.error("物件を登録できませんでした", error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};

/**
 * 物件を更新する。
 *
 * `createdAt`は更新の対象にしない。一覧の並び順(登録順)が編集のたびに入れ替わらないように
 * するためで、`firestore.rules`側でも変更を拒否している。
 *
 * 履歴を積むかどうかを決めるために、書き込む前に**保存済みの値を読む**(`shouldRecordValueHistory`)。
 * 画面が持っている値と比べる形にしないのは、別のタブで先に更新されていた場合に「変わって
 * いない」と誤判定して記録を落とすため。
 *
 * **履歴はマップ全体ではなく、その日のキーだけを書く**(`valueHistory.<yyyy-MM-dd>`)。
 * 読んでから書くまでの間に別のタブが別の日の記録を積んでいても、こちらの書き込みが
 * それを消さない。マップ全体を送る形だと、読んだ時点の履歴で上書きして相手の記録が消える
 * (B11が保存で負債を消していた不具合と同じ形。docs/development-workflow.md 6章)。
 */
export const updateRealEstateProperty = async (
  id: string,
  input: RealEstatePropertyInput,
): Promise<SaveRealEstatePropertyResult> => {
  const context = resolveFirestoreUserContext();

  if (!context.ok) {
    return context;
  }

  try {
    const reference = doc(propertiesRef(context.firestore, context.uid), id);
    const snapshot = await getDoc(reference);
    const existing = snapshot.exists()
      ? toRealEstateProperty(snapshot.id, snapshot.data())
      : undefined;
    const today = format(new Date(), STORED_DATE_FORMAT);

    if (!shouldRecordValueHistory(existing, input)) {
      await updateDoc(reference, toDocumentFields(input, today));

      return { ok: true, id };
    }

    if (
      resolveNextValueHistoryCount(existing?.valueHistory ?? {}, today) >
      REAL_ESTATE_VALUE_HISTORY_MAX
    ) {
      // 古い記録から捨てる案は採らない。過去の資産推移グラフの値が、時価を更新しただけで
      // 黙って変わることになるため(B7「時価・ローン残高の履歴」)。到達しない前提の歯止め
      return { ok: false, reason: "history-limit-exceeded" };
    }

    await updateDoc(reference, {
      ...toDocumentFields(input, today),
      [`valueHistory.${today}`]: {
        marketValue: input.marketValue,
        loanBalance: input.loanBalance,
      },
    });

    return { ok: true, id };
  } catch (error) {
    console.error("物件を更新できませんでした", id, error);
    return { ok: false, reason: toFirestoreFailureReason(error) };
  }
};
