/**
 * B5の見た目を確認するためのサンプルデータ。
 *
 * 物件を登録する画面(B7)がまだ無く、Firestoreに実データが存在しないための一時的な置き換えで
 * ある(`src/lib/transactions/sample-data.ts`と同じ位置付け)。データの繋ぎ込み時にこのファイル
 * ごと削除し、`src/lib/real-estate/real-estate-data.ts`の取得元を差し替える。
 *
 * 物件は日付に依存しない静的な値なので、取引・資産残高のサンプルと違って生成関数にしない。
 */

/**
 * サンプルの物件。並びは登録順のつもりで固定する。
 *
 * ローン完済済み(残高0)の物件を混ぜてあるのは、`- ¥` が付かず `¥ 0` と出ることを
 * 画面で確かめられるようにするため。
 */
export const SAMPLE_REAL_ESTATE_PROPERTIES: RealEstateProperty[] = [
  {
    id: "sample-shibuya-101",
    name: "〇〇マンション101号室",
    location: "東京都渋谷区神南1-2-3",
    marketValue: 32_000_000,
    loanBalance: 18_400_000,
  },
  {
    id: "sample-yokohama-202",
    name: "△△アパート202号室",
    location: "神奈川県横浜市中区本町4-5-6",
    marketValue: 21_500_000,
    loanBalance: 15_200_000,
  },
  {
    id: "sample-chiba-house",
    name: "□□戸建て",
    location: "千葉県市川市八幡7-8-9",
    marketValue: 18_000_000,
    loanBalance: 0,
  },
];
