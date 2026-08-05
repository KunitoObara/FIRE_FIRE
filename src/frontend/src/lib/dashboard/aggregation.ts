import { format, parseISO } from "date-fns";

/**
 * 資産残高(`users/{uid}/assetSnapshots`)を、分類軸ごとの表示用データへ集計する(B1)。
 *
 * 分類軸(B4)は「集計対象の資産種別名」の集合でしかなく、集計そのものはアプリ側で行う。
 * 資産種別はマネーフォワードのCSVの列名で増減するため、種別名をコードに持たない
 * (docs/fire-asset-management-requirements.md 4.3の拡張性要件)。
 *
 * Firestoreを引く処理は含めず、入力の形だけに依存する純粋な関数に閉じている。
 */

/** 月をまたぐ判定に使うキー(`yyyy-MM`) */
const MONTH_KEY_FORMAT = "yyyy-MM";

/**
 * 分類軸の集計対象かどうか。
 *
 * `assetTypeNames`が空配列の分類軸は「すべての資産種別が対象」を意味する(B4)。
 * 総資産のような軸を特別扱いのコードなしに登録できるようにするための約束事。
 */
const isAxisTarget = (assetTypeNames: string[], assetTypeName: string): boolean =>
  assetTypeNames.length === 0 || assetTypeNames.includes(assetTypeName);

/**
 * 1日分の資産残高を、分類軸の集計対象に絞って合計する。
 *
 * CSVの「合計（円）」列(`total`)は使わない。分類軸が資産種別の部分集合を指す以上、
 * 合計は常に対象種別の足し合わせで求める必要があり、全種別が対象の軸だけ別の値を
 * 使うと同じ画面の中で合計の出所が2つに分かれるため。
 */
export const sumAxisAmount = (snapshot: AssetSnapshot, assetTypeNames: string[]): number =>
  Object.entries(snapshot.byType).reduce(
    (sum, [assetTypeName, amount]) =>
      isAxisTarget(assetTypeNames, assetTypeName) ? sum + amount : sum,
    0,
  );

/**
 * 分類軸の資産推移を月次で組み立てる。
 *
 * マネーフォワードの「資産推移」は当月が日次・それ以前は月末日のみという混在で、
 * 取り込んだ日付の間隔は一定にならない(src/lib/csv/asset-balance-csv.ts)。
 * そのままの間隔で描くと点の密度が期間によって変わり、グラフの目盛り(`yyyy/MM`)や
 * ツールチップ(`yyyy年M月`)と1対1で対応しなくなるため、**その月でいちばん新しい
 * 集計日の残高**をその月の値として1点に集約する。
 *
 * 点の日付は月初ではなく採用した集計日そのものにする。実在しない日付を作らず、
 * 「1年」等の期間の絞り込み(`filterSeriesByPeriod`)も実データの日付で判定できる。
 */
export const buildAxisNetWorthSeries = (
  snapshots: AssetSnapshot[],
  assetTypeNames: string[],
): NetWorthPoint[] => {
  const byMonth = new Map<string, AssetSnapshot>();

  // 呼び出し側の並び順に依存しないよう、ここで日付の昇順に並べ直してから畳み込む
  const ordered = [...snapshots].sort((left, right) => left.date.localeCompare(right.date));

  for (const snapshot of ordered) {
    byMonth.set(format(parseISO(snapshot.date), MONTH_KEY_FORMAT), snapshot);
  }

  return [...byMonth.values()].map((snapshot) => ({
    date: snapshot.date,
    amount: sumAxisAmount(snapshot, assetTypeNames),
  }));
};

/**
 * 分類軸の分類別内訳を、直近の資産残高から組み立てる。
 *
 * 内訳は「いま何をどれだけ持っているか」なので、期間の絞り込みとは無関係に最新の
 * 1日分だけを見る。分類は資産種別そのもので、`categoryId`には種別名を使う
 * (資産種別に専用のマスタが無く、CSVの列名が唯一の識別子であるため)。
 *
 * 0円以下の資産種別は除く。円グラフの構成比は正の値でしか意味を持たず、
 * 0円のスライスは凡例を埋めるだけになるため。
 */
export const buildAxisBreakdown = (
  snapshot: AssetSnapshot,
  assetTypeNames: string[],
): AssetBreakdownEntry[] =>
  Object.entries(snapshot.byType).flatMap(([assetTypeName, amount]) =>
    isAxisTarget(assetTypeNames, assetTypeName) && amount > 0
      ? [{ categoryId: assetTypeName, amount }]
      : [],
  );

/**
 * 内訳の色割り当ての元になる分類の一覧を、直近の資産残高から組み立てる。
 *
 * 色は分類ごとに固定で、この配列の並び順がそのまま色スロットになる
 * (`buildBreakdownSlices`。DESIGN.md 3章)。そのため並びは分類軸や金額で変わらない
 * 基準で決める必要があり、B4の集計対象の選択肢(`fetchAssetTypeOptions`)と同じ
 * 日本語の名前順に揃える。分類軸を切り替えても同じ資産種別の色が変わらない。
 *
 * 対象は直近の1日分に現れる資産種別だけにする。過去にだけ存在した種別まで含めると、
 * もう保有していない種別が色スロット(8つ)を占め、現在の内訳が「その他」に押し出される。
 */
export const collectAssetCategories = (snapshot: AssetSnapshot | undefined): AssetCategory[] =>
  snapshot === undefined
    ? []
    : Object.keys(snapshot.byType)
        .sort((left, right) => left.localeCompare(right, "ja"))
        .map((assetTypeName) => ({ id: assetTypeName, name: assetTypeName }));
