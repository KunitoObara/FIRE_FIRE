import { USE_SAMPLE_REAL_ESTATE_DATA } from "@/constants/real-estate";
import { SAMPLE_REAL_ESTATE_PROPERTIES } from "@/lib/real-estate/sample-data";

/** 物件を一度も登録していないアカウントの状態 */
const EMPTY_REAL_ESTATE_PROPERTIES: RealEstateProperty[] = [];

/**
 * B5が表示する物件を取得する。
 *
 * 現時点では物件を登録する画面(B7)が無くFirestoreに実データが無いため、
 * `USE_SAMPLE_REAL_ESTATE_DATA`に従ってサンプルデータか空配列を返すだけの関数である
 * (`src/lib/transactions/transactions-data.ts`の`getTransactionsData`と同じ位置付け)。
 * B7が実装された時点で、ここをFirestore(`users/{uid}/properties`)からの取得に差し替える。
 */
export const getRealEstateProperties = (): RealEstateProperty[] =>
  USE_SAMPLE_REAL_ESTATE_DATA ? SAMPLE_REAL_ESTATE_PROPERTIES : EMPTY_REAL_ESTATE_PROPERTIES;

/**
 * B6が表示する物件1件を、URLの物件IDから取得する。
 *
 * 該当が無ければ`undefined`を返し、404にするかどうかは呼び出す画面側に任せる
 * (削除済みの物件をブックマークから開いた場合などが該当する)。
 * Firestoreへの繋ぎ込み時には、ここを`users/{uid}/properties/{id}`のドキュメント取得に
 * 差し替える(全件取得してから絞る形をそのまま残さない)。
 */
export const getRealEstateProperty = (id: string): RealEstateProperty | undefined =>
  getRealEstateProperties().find((property) => property.id === id);
