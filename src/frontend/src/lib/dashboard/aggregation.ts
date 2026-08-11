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
 * その負債が資産推移グラフに現れ始める起点(`yyyy-MM-dd`)。記録も発生年月も無い負債は`null`。
 *
 * - B11の**発生年月**が入っていれば、**その月の1日**
 * - 入っていなければ、**最も古い記録の日**(発生年月を入れる前と同じ振る舞い)
 *
 * 発生年月は`yyyy-MM`、履歴のキーと資産残高の集計日は`yyyy-MM-dd`なので、**日付の桁に
 * 揃えてから比べる**(月へ切り詰める向きに揃えない)。月に揃えると、発生年月を入れていない
 * 負債で「最初の記録と同じ月の、記録より前の日」まで起点に含まれてしまい、
 * 記録した日から反映するという既存の約束が崩れる。
 */
const resolveDebtOriginDate = (debt: Debt): string | null => {
  if (debt.originatedOn !== null) {
    return `${debt.originatedOn}-01`;
  }

  const recordedDates = Object.keys(debt.balanceHistory);

  return recordedDates.length === 0
    ? null
    : recordedDates.reduce((left, right) => (left < right ? left : right));
};

/**
 * ある時点の残債を、残債の履歴から求める。
 *
 * **その時点以前で最も新しい記録**を採る(docs/screen-requirements-dashboard.md B1)。
 * 残債は手動更新だが、B11が保存のたびにその日の残債を履歴として残すため、過去の点も
 * 当時の残債で引ける。
 *
 * **起点より前の時点は0を返し、差し引かない。** 残債が分からない期間に現在の値を当てると、
 * 実際には無かった負債を過去に作ることになる。起点の月に段差が出るが、これは
 * 「そこから負債を負った」という事実の表示。
 *
 * **起点以降で、その時点以前の記録がまだ無い期間は、最も古い記録の残債を遡って当てる**
 * (同要件「発生年月からの反映」)。発生年月を入れた負債は履歴より前から反映されるため、
 * この期間が生まれる。実際の残債はアプリが知りえないので、知っている中でいちばん古い値を
 * 置く — 返済前の残債は今より多いのが普通なので実態より少なく出るが、起点が
 * 「アプリに登録した月」のままである読み違いのほうが大きい([B11-7](https://trello.com/c/zNKoKCOn))。
 *
 * **発生年月より前の記録も、残債の値としては使う。** 発生年月が効くのは「いつから差し引くか」
 * だけで、記録を選ぶ範囲は狭めない。狭めると、**発生年月より前の記録しか持たない負債**
 * (発生年月だけを後から入力し、残債が変わっていないので履歴が増えていない場合)で
 * 起点以降に採れる記録が1件も無くなり、過去の全期間が残債0円になる。実際にはずっとあった
 * 負債が消えて純資産が過大に出るうえ、最後の点だけ現在の残債に戻るので、このカードが
 * 解消しようとした「右端の崖」が残る([PR #143](https://github.com/KunitoObara/FIRE_FIRE/pull/143) のレビュー指摘)。
 * 発生年月より前の点を差し引かないことは、入口の`date < originDate`だけで担保できている。
 *
 * 履歴のキーは`yyyy-MM-dd`固定なので、日付の比較は文字列のままで辞書順=時系列になる
 * (`Date`へ直すとタイムゾーンの解釈が入る)。
 */
export const resolveDebtBalanceAt = (debt: Debt, date: string): number => {
  const originDate = resolveDebtOriginDate(debt);

  if (originDate === null || date < originDate) {
    return 0;
  }

  let latestDate: string | null = null;
  let latestBalance: number | null = null;
  let earliestDate: string | null = null;
  let earliestBalance = 0;

  for (const [recordedDate, balance] of Object.entries(debt.balanceHistory)) {
    if (recordedDate <= date && (latestDate === null || recordedDate > latestDate)) {
      latestDate = recordedDate;
      latestBalance = balance;
    }

    if (earliestDate === null || recordedDate < earliestDate) {
      earliestDate = recordedDate;
      earliestBalance = balance;
    }
  }

  /*
    その時点以前の記録が無ければ、起点から最初の記録までの期間にいる。ここに来るのは
    発生年月を入れた負債だけで、入れていない負債は起点が最初の記録の日そのものなので、
    「起点以降で記録がまだ無い」区間が存在しない
  */
  return latestBalance ?? earliestBalance;
};

/** ある時点で分類軸が差し引く残債の合計(**過去の点に使う**。「いま」は`sumDebtBalance`) */
export const sumDebtBalanceAt = (axisDebts: Debt[], date: string): number =>
  axisDebts.reduce((sum, debt) => sum + resolveDebtBalanceAt(debt, date), 0);

/**
 * 分類軸が差し引く**現在の**残債の合計(B11で最後に保存した残債)。
 *
 * **「いま」を表す表示はこちらを使う**(docs/screen-requirements-dashboard.md B1
 * 「負債を含む分類軸の集計」)。対象は資産推移グラフの最新点・分類別内訳の負債スライスと
 * 純額の併記・FIRE達成度ゲージの現在資産額の3つで、履歴(`sumDebtBalanceAt`)に従うのは
 * 過去の点だけ。
 *
 * 履歴を「いま」にも当てると、**負債を登録した直後に負債がどこにも現れない**。残債の履歴に
 * 付く日付は保存した日だが、資産残高の最新の日付はマネーフォワードのCSVを最後に取り込んだ日で、
 * 後者が古いのが普通の状態(CSVは日次で増えるものではない)。「その時点以前で最も新しい記録」を
 * 最新点にも当てると全ての点で記録が見つからず、残債が0として扱われる。
 */
export const sumDebtBalance = (axisDebts: Debt[]): number =>
  axisDebts.reduce((sum, debt) => sum + debt.balance, 0);

/**
 * 1日分の資産残高を、分類軸の集計対象に絞って合計し、渡された残債を差し引く。
 *
 * CSVの「合計（円）」列(`total`)は使わない。分類軸が資産種別の部分集合を指す以上、
 * 合計は常に対象種別の足し合わせで求める必要があり、全種別が対象の軸だけ別の値を
 * 使うと同じ画面の中で合計の出所が2つに分かれるため。
 *
 * **差し引く残債は呼び出し側が決めて`debtTotal`で渡す。** この関数は推移グラフの過去の点
 * (履歴の残債)と「いま」を表す表示(現在の残債)の両方から呼ばれ、どちらを引くかは
 * 呼び出し元の意味で決まるため(docs/screen-requirements-dashboard.md B1)。負債の一覧を
 * 受け取って中で時点を決める形にすると、1つの関数が2つの意味を抱えることになる。
 *
 * 資産推移グラフの最新点とFIRE達成度ゲージの現在資産額が一致するという約束は、両者が
 * この関数に**同じ`debtTotal`**(`sumDebtBalance`)を渡すことで保たれる。
 *
 * 差し引いた結果は**負になりうる**。負債が資産を上回る状態そのものなので0で止めない。
 * ゲージの達成率だけは0%に丸めるが、それは表示側の判断(`FireProgressGauge`)。
 */
export const sumAxisAmount = (
  snapshot: AssetSnapshot,
  assetTypeNames: string[],
  debtTotal: number,
): number =>
  Object.entries(snapshot.byType).reduce(
    (sum, [assetTypeName, amount]) =>
      isAxisTarget(assetTypeNames, assetTypeName) ? sum + amount : sum,
    0,
  ) - debtTotal;

/**
 * 1日分の資産残高から、分類軸の集計対象になる資産種別だけを取り出す。
 *
 * 積み上げ表示が描く値(docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
 * **負債は引かず、マイナス残高の資産種別も符号のまま残す。** 0に丸めると、その種別を
 * 保有していること自体が画面から消える。
 */
export const pickAxisAmountsByType = (
  snapshot: AssetSnapshot,
  assetTypeNames: string[],
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(snapshot.byType).filter(([assetTypeName]) =>
      isAxisTarget(assetTypeNames, assetTypeName),
    ),
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
 *
 * **差し引く残債は、最後の点だけ現在の残債(`sumDebtBalance`)にする。** 最後の点は
 * 「いま何をどれだけ持っているか」を表す点で、円グラフ・FIRE達成度ゲージと同じものを
 * 指すため(docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
 * 過去の点は当時の残債(`sumDebtBalanceAt`)に従う。
 *
 * 資産残高の最新日より後に負債を保存していると、最後の点にだけ段差が出る。これは
 * 「そこから負債を管理し始めた」段差が右端に寄っただけで、隠す対象ではない(同要件)。
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

  // 昇順に畳み込んでいるので、`Map`の挿入順の末尾が直近の資産残高になる
  const monthly = [...byMonth.values()];
  const currentDebtTotal = sumDebtBalance(axisDebts);

  return monthly.map((snapshot, index) => ({
    date: snapshot.date,
    amount: sumAxisAmount(
      snapshot,
      assetTypeNames,
      index === monthly.length - 1 ? currentDebtTotal : sumDebtBalanceAt(axisDebts, snapshot.date),
    ),
    // 積み上げ表示が描く値。純額(`amount`)とは別に持つ(型の取り決め)
    byType: pickAxisAmountsByType(snapshot, assetTypeNames),
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
 * 分類別内訳のカードに併記する、差引後の純額(対象の資産合計 - 対象の負債合計)。
 * 負債を含まない分類軸は`null`で、カードは併記そのものを出さない。
 *
 * **円グラフのスライス(`breakdown`)を足し直して求めない。** `buildAxisBreakdown`は
 * 「0円以下の資産種別を除く」フィルタを掛けているのに対し、資産推移グラフとFIRE達成度
 * ゲージが使う`sumAxisAmount`は符号を問わず全ての対象種別を足す。マネーフォワードのCSVには
 * 借入・信用取引のようにマイナス残高で現れる種別があり、それが混じる分類軸では足し直した
 * 純額だけが推移グラフの最新点・ゲージの現在資産額とずれる。「同じ分類軸を選んだときに
 * 推移グラフの最新点とゲージの現在資産額が一致する」という約束(B1)は純額にも及ぶ。
 *
 * そのため既に`sumAxisAmount`を通した結果である推移の最新点をそのまま採る。推移の各点は
 * その月でいちばん新しい集計日の残高なので、末尾は直近の資産残高そのものになり、
 * どちらも現在の残債(`sumDebtBalance`)を引いているため`debtTotal`とも辻褄が合う。
 *
 * **表示期間で絞り込む前の推移を渡すこと。** 絞り込んだ後の末尾は期間内で最も新しい点に
 * すぎず、「いま何をどれだけ持っているか」を表す内訳の相手ではなくなる。
 */
export const resolveAxisNetAmount = (axisData: AssetAxisData | undefined): number | null =>
  axisData === undefined || axisData.debtTotal <= 0
    ? null
    : (axisData.netWorthSeries.at(-1)?.amount ?? null);

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
/**
 * 収支サマリの集計対象になる取引かどうか(docs/transaction-import-requirements.md 5章)。
 *
 * **振替と計算対象外は取り込んだうえで集計から外す。** 自口座間の移動は収入と支出の両方に
 * 現れるため、数えると収支が0のまま両者だけが膨らみ、費目別支出でも実態のない支出が
 * 最上位に来る。計算対象はマネーフォワード側でユーザーが下した判断そのものなので、
 * アプリ側で読み替えない。どちらもB3の一覧には印付きで出る。
 */
const isCashflowTarget = (transaction: Transaction): boolean =>
  !transaction.isTransfer && transaction.isCalculationTarget;

/**
 * 費目別支出を大項目で集計する(同書6章)。
 *
 * 中項目まで割ると項目数が多くなりすぎ、ダッシュボードのカードとして読めない。中項目まで
 * 見たい場合はB3へ渡す。金額の多い順に並べるのは、限られた高さのカードで先に目に入る位置へ
 * 大きい支出を置くため(負債サマリと同じ考え方)。
 */
const buildExpenseByCategory = (expenses: Transaction[]): ExpenseByCategory[] => {
  const totals = new Map<string, number>();

  expenses.forEach((transaction) => {
    const name = transaction.categoryMajor;
    // 支出は負の値で入っているので、ここで絶対値にする(型の取り決め)
    totals.set(name, (totals.get(name) ?? 0) + Math.abs(transaction.amount));
  });

  return [...totals]
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
};

/**
 * 当月の取引から収支サマリを組み立てる(B1「収支サマリ」)。
 *
 * 渡すのは**当月分の取引だけ**(`fetchMonthlyTransactions`)。この関数は期間で絞らない。
 *
 * **収入・支出とも0以上で返す。** 符号を落とすのは集計のこの時点で、表示側では反転しない
 * (`CashflowSummary`の取り決め。同書5章)。
 *
 * 取引が1件も無ければ`null`を返し、カードは空状態のまま(月初は正常にこの状態になるので
 * エラーとして扱わない)。**取引はあるが全てが集計対象外だった場合は`null`にしない** —
 * 0円として出す。空状態は「まだ取り込んでいない」と読める案内を出すので、振替しかない月に
 * それを見せると、取り込んである取引を「無い」と伝えることになる。
 */
export const buildCashflowSummary = (
  transactions: Transaction[],
  now: Date,
): CashflowSummary | null => {
  if (transactions.length === 0) {
    return null;
  }

  const targets = transactions.filter(isCashflowTarget);
  const expenses = targets.filter((transaction) => transaction.amount < 0);

  return {
    month: format(now, MONTH_KEY_FORMAT),
    income: targets
      .filter((transaction) => transaction.amount > 0)
      .reduce((total, transaction) => total + transaction.amount, 0),
    expense: expenses.reduce((total, transaction) => total + Math.abs(transaction.amount), 0),
    expenseByCategory: buildExpenseByCategory(expenses),
  };
};

export const collectAssetCategories = (snapshot: AssetSnapshot | undefined): AssetCategory[] =>
  snapshot
    ? Object.keys(snapshot.byType)
        .sort((left, right) => left.localeCompare(right, "ja"))
        .map((assetTypeName) => ({ id: assetTypeName, name: assetTypeName }))
    : [];
