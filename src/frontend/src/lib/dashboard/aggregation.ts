import { format, parseISO } from "date-fns";

/**
 * 資産残高(`users/{uid}/assetSnapshots`)を、分類軸ごとの表示用データへ集計する(B1)。
 *
 * 分類軸(B4)は「集計対象の資産種別名」と「差し引く負債のID」の集合で、集計そのものは
 * アプリ側で行う。資産種別はマネーフォワードのCSVの列名で増減し、負債はB11でユーザーが
 * 登録するため、どちらも名前・件数をコードに持たない
 * (docs/fire-asset-management-requirements.md 4.3の拡張性要件)。
 *
 * 負債を含む分類軸の集計は「**対象の資産種別の合計 - 対象の負債の残債**」になる
 * (docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
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
 *
 * **この読み替えは負債には適用しない。** 負債を1件も選んでいない分類軸は
 * 「負債を差し引かない」を意味する(`resolveAxisDebts`)。
 */
const isAxisTarget = (assetTypeNames: string[], assetTypeName: string): boolean =>
  assetTypeNames.length === 0 || assetTypeNames.includes(assetTypeName);

/**
 * 分類軸が差し引く負債を選び出す。
 *
 * 空配列の`debtIds`は「負債を差し引かない」を意味するので、`isAxisTarget`のような
 * 「未選択=すべて」の読み替えをしない(B4)。両方を「未選択=すべて」にすると、
 * 負債の選択を持たない既存の分類軸が、負債の登録と同時に黙って純資産の軸へ変わる。
 *
 * **分類軸が参照している負債がB11で削除されていた場合は、そのまま落ちる。** 存在しない
 * 資産種別が`byType`に無いときと同じ扱いで、グラフやゲージを出さない扱いにはしない
 * (docs/screen-requirements-dashboard.md B1)。
 */
export const resolveAxisDebts = (debts: Debt[], debtIds: string[]): Debt[] => {
  const targetIds = new Set(debtIds);

  return debts.filter((debt) => targetIds.has(debt.id));
};

/**
 * ある時点の残債を、残債の履歴から求める。
 *
 * **その時点以前で最も新しい記録**を採る(docs/screen-requirements-dashboard.md B1)。
 * 残債は手動更新だが、B11が保存のたびにその日の残債を履歴として残すため、過去の点も
 * 当時の残債で引ける。
 *
 * **記録が1件も無い時点(=負債を登録する前の期間)は0を返し、差し引かない。** 残債が
 * 分からない期間に現在の値を当てると、実際には無かった負債を過去に作ることになる。
 * 最初の記録の日に段差が出るが、これは「そこから負債を管理し始めた」という事実の表示。
 *
 * 履歴のキーは`yyyy-MM-dd`固定なので、日付の比較は文字列のままで辞書順=時系列になる
 * (`Date`へ直すとタイムゾーンの解釈が入る)。
 */
export const resolveDebtBalanceAt = (debt: Debt, date: string): number => {
  let latestDate: string | null = null;
  let latestBalance = 0;

  for (const [recordedDate, balance] of Object.entries(debt.balanceHistory)) {
    if (recordedDate <= date && (latestDate === null || recordedDate > latestDate)) {
      latestDate = recordedDate;
      latestBalance = balance;
    }
  }

  return latestBalance;
};

/** ある時点で分類軸が差し引く残債の合計 */
export const sumDebtBalanceAt = (axisDebts: Debt[], date: string): number =>
  axisDebts.reduce((sum, debt) => sum + resolveDebtBalanceAt(debt, date), 0);

/**
 * 1日分の資産残高を、分類軸の集計対象に絞って合計し、対象の負債の残債を差し引く。
 *
 * CSVの「合計（円）」列(`total`)は使わない。分類軸が資産種別の部分集合を指す以上、
 * 合計は常に対象種別の足し合わせで求める必要があり、全種別が対象の軸だけ別の値を
 * 使うと同じ画面の中で合計の出所が2つに分かれるため。
 *
 * 負債はその資産残高の**集計日時点**の残債を引く。現在の残債で全期間を引く形にしないのは
 * `resolveDebtBalanceAt`のとおりで、資産推移グラフの各点とFIRE達成度ゲージの現在資産額が
 * この関数を共有することで一致する(B1)。
 *
 * 差し引いた結果は**負になりうる**。負債が資産を上回る状態そのものなので0で止めない。
 * ゲージの達成率だけは0%に丸めるが、それは表示側の判断(`FireProgressGauge`)。
 */
export const sumAxisAmount = (
  snapshot: AssetSnapshot,
  assetTypeNames: string[],
  axisDebts: Debt[],
): number =>
  Object.entries(snapshot.byType).reduce(
    (sum, [assetTypeName, amount]) =>
      isAxisTarget(assetTypeNames, assetTypeName) ? sum + amount : sum,
    0,
  ) - sumDebtBalanceAt(axisDebts, snapshot.date);

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
  axisDebts: Debt[],
): NetWorthPoint[] => {
  const byMonth = new Map<string, AssetSnapshot>();

  // 呼び出し側の並び順に依存しないよう、ここで日付の昇順に並べ直してから畳み込む
  [...snapshots]
    .sort((left, right) => left.date.localeCompare(right.date))
    .forEach((snapshot) => {
      byMonth.set(format(parseISO(snapshot.date), MONTH_KEY_FORMAT), snapshot);
    });

  return [...byMonth.values()].map((snapshot) => ({
    date: snapshot.date,
    amount: sumAxisAmount(snapshot, assetTypeNames, axisDebts),
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
 *
 * **負債はここには含めない。** 残債は正の値で持ち符号の扱いが資産と逆なので、同じ
 * 「0円以下は除く」の判定に載せられない。負債のスライスは`buildBreakdownSlices`が
 * 資産のスライスとは別に組み立てる(色スロットも消費しない。DESIGN.md 3章)。
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
  snapshot
    ? Object.keys(snapshot.byType)
        .sort((left, right) => left.localeCompare(right, "ja"))
        .map((assetTypeName) => ({ id: assetTypeName, name: assetTypeName }))
    : [];
