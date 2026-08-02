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
