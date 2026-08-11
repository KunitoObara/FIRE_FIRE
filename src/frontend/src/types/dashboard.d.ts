export {};

declare global {
  /** B1の表示期間切替の選択肢(docs/screen-requirements-dashboard.md B1) */
  type DashboardPeriodId = "1y" | "3y" | "5y" | "all";

  /** 表示期間の1選択肢 */
  type DashboardPeriod = {
    id: DashboardPeriodId;
    label: string;
    /** 現在からさかのぼる年数。全期間は`null` */
    years: number | null;
  };

  /**
   * 分類軸(総資産・純金融資産・投資性資産など)。
   * B4 資産分類マスタ設定画面でユーザーが追加・編集するマスタデータで、コード側で固定しない
   * (docs/fire-asset-management-requirements.md 4.3)。
   */
  type AssetCategoryAxis = {
    id: string;
    name: string;
  };

  /**
   * 分類軸の内訳を構成する分類(現金・預金、投資信託など)。
   * これもB4のマスタデータであり、件数・名称ともコード側の前提にしない。
   */
  type AssetCategory = {
    id: string;
    name: string;
  };

  /** 資産推移グラフの1点(月に1点) */
  type NetWorthPoint = {
    /**
     * その月を代表する集計日(`yyyy-MM-dd`)。
     * 月内でいちばん新しい資産残高の日付をそのまま使う(`buildAxisNetWorthSeries`)
     */
    date: string;
    /**
     * 純額(対象の資産種別の合計 - その時点の対象の負債の残債)。**純資産表示が描く値**。
     *
     * **`byType`から足し直さない。** FIRE達成度ゲージの現在資産額と一致するのはこの値で
     * (docs/screen-requirements-dashboard.md B1)、`resolveAxisNetAmount`もこれを採る。
     */
    amount: number;
    /**
     * 対象の資産種別ごとの額(種別名 → 円)。**積み上げ表示が描く値**。
     *
     * 負債は引かず、マイナス残高の種別は符号のまま持つ(同要件B1「積み上げ表示」)。
     * したがって値の総和は`amount`と一致しない(負債を含む分類軸の場合)。
     */
    byType: Record<string, number>;
    /**
     * その時点で対象の負債から差し引いた残債(0以上)。**負債反映ONの帯が描く値**。
     *
     * 負債の帯の高さを`byType`の総和と`amount`の差から逆算しない。逆算はフィルタの有無に
     * 依存する脆い読み方になるため、集計側(`buildAxisNetWorthSeries`)で明示的に持たせる
     * (docs/screen-requirements-dashboard.md B1「実装時に直すもの」)。
     *
     * 最新点だけは履歴ではなく現在の残債(同要件「いま」の扱い)。
     */
    debtBalance: number;
  };

  /** 資産推移グラフの負債反映切替(docs/screen-requirements-dashboard.md B1「資産推移グラフの負債反映切替」) */
  type NetWorthTrendModeId = "with-debt" | "assets-only";

  /** 切替の1選択肢 */
  type NetWorthTrendMode = {
    id: NetWorthTrendModeId;
    label: string;
  };

  /**
   * 積み上げ表示の1本の帯。色スロットの割り当ては分類別内訳の円グラフと共有する
   * (`buildCategoryColorSlots`)。
   */
  type NetWorthTrendBand = {
    /** 資産種別名。スロットに収まらない種別は`OTHER_CATEGORY_ID`にまとめる */
    categoryId: string;
    name: string;
    /** `var(--chart-N)`形式のCSS変数参照 */
    color: string;
  };

  /**
   * 積み上げ表示に渡す1点。`byType`を色スロットごとに寄せ集めたもの。
   *
   * 帯の額は`categoryId`をキーに持つ。Rechartsが`dataKey`で引くため、種別名をそのまま
   * キーにした平らな形にしている。
   */
  type NetWorthStackedPoint = {
    date: string;
    /**
     * ツールチップに出す合計。**行に並べた額の総和**で、負の資産種別も符号のまま加える。
     *
     * 負債反映ONのときは負債の行(負の値)も含むので、合計はその時点の純資産そのものになる。
     * OFFのときは資産種別だけの合計(docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
     */
    total: number;
    amounts: Record<string, number>;
  };

  /** 分類別内訳の1分類分の金額 */
  type AssetBreakdownEntry = {
    categoryId: string;
    amount: number;
  };

  /** 表示用に色と構成比を解決した内訳の1要素 */
  type AssetBreakdownSlice = {
    categoryId: string;
    name: string;
    amount: number;
    /** 構成比(0〜1)。合計が0のときは0 */
    ratio: number;
    /** `var(--chart-N)`形式のCSS変数参照 */
    color: string;
  };

  /** 分類軸ごとの資産データ */
  type AssetAxisData = {
    netWorthSeries: NetWorthPoint[];
    /** 資産種別の内訳。負債は含まない(符号の扱いが逆なため別に持つ) */
    breakdown: AssetBreakdownEntry[];
    /**
     * この分類軸が差し引く負債の残債合計(直近の資産残高の時点)。
     *
     * 負債を含まない分類軸は0。円グラフの負債スライスと、差引後の純額の併記に使う
     * (docs/screen-requirements-dashboard.md B1「負債を含む分類軸の集計」)。
     */
    debtTotal: number;
  };

  /** FIRE達成度ゲージの表示値。目標未設定なら`null`が渡る */
  type FireProgress = {
    targetAmount: number;
    /**
     * 現在資産額(円)。B8で設定した対象分類で集計する。
     * B1の分類軸切替セレクタには追従しない(docs/screen-requirements-dashboard.md B1)
     */
    currentAmount: number;
    /** 現在資産額に併記する対象分類名。既定なら「総資産(マネーフォワードの合計)」 */
    achievementAxisName: string;
    /**
     * 設定していた対象分類がB4で削除されていた場合に`true`。
     * 既定で計算したうえで、カードにその旨とB8への導線を出すために使う(同要件B1)
     */
    achievementAxisMissing: boolean;
    /**
     * 到達予測日(`yyyy-MM-dd`)。想定利回り(B9)を前提に算出するため、
     * B1では計算せず算出済みの値を表示するだけにする。未算出は`null`
     */
    projectedAchievementDate: string | null;
  };

  /** 収支サマリの費目別支出の1行(費目は大項目。粒度は同書6章) */
  type ExpenseByCategory = {
    name: string;
    /** **0以上。** 支出は絶対値で持つ(`CashflowSummary`の取り決め) */
    amount: number;
  };

  /**
   * 収支サマリ(当月)。
   *
   * **`expense` と `expenseByCategory[].amount` は0以上の値で組み立てる**
   * (docs/transaction-import-requirements.md 5章「集計した値の符号」)。収入は `amount > 0`
   * の合計、支出は `amount < 0` の合計の**絶対値**で、符号を落とすのは集計の時点。
   * 表示側では反転しない。
   *
   * `CashflowSummaryCard`が値を加工せず受け取る契約になっているため。収支を `income - expense`
   * で出し、支出も費目別支出も`formatJpy`へそのまま渡す。`formatJpy`は負の値を `- ¥ 84,200` と
   * 符号付きにするので、支出を負のまま入れると**支出にマイナスが付く**うえ、収支が
   * `income + |支出|` になって**赤字が黒字として出る**。
   *
   * 生CSVの符号(支出がマイナス)を保つのは`Transaction.amount`とB3の一覧だけ。
   */
  type CashflowSummary = {
    /** 対象月(`yyyy-MM`) */
    month: string;
    /** 0以上 */
    income: number;
    /** 0以上(絶対値) */
    expense: number;
    expenseByCategory: ExpenseByCategory[];
  };

  /** B1が表示するデータ一式 */
  type DashboardData = {
    /** 直近CSV取込日時(ISO 8601)。未取込は`null` */
    lastImportedAt: string | null;
    axes: AssetCategoryAxis[];
    /** 内訳に使う分類のマスタ。並び順が色の割り当て順になる */
    categories: AssetCategory[];
    /** 分類軸IDをキーにした資産データ */
    byAxis: Record<string, AssetAxisData>;
    /**
     * 登録済みの負債(B11)。負債サマリがそのまま並べる。
     *
     * 分類軸で絞ったものは渡さない。負債サマリは分類軸切替セレクタの影響を受けず、
     * 絞ると「登録したのに出てこない負債」が生まれるため(同要件B1「負債サマリ」)。
     */
    debts: Debt[];
    fireProgress: FireProgress | null;
    cashflow: CashflowSummary | null;
  };

  /**
   * B1の表示データの取得結果。
   *
   * 「まだデータが無い」は失敗ではなく、空の`DashboardData`として`ok: true`で返る。
   * 失敗は取得そのものができなかった場合だけを指す。
   */
  type DashboardDataResult =
    { ok: true; data: DashboardData } | { ok: false; reason: FirestoreAccessFailureReason };

  /**
   * B1本体のProps。
   *
   * 分類軸・表示期間はURLのクエリパラメータで受け取る。`useSearchParams`はSuspense境界を
   * 要求するため、値の取り出しはServer Component側(page.tsx)で行う(A7と同じ形)。
   * 分類軸IDの妥当性はFirestoreから取得した分類軸が揃ってからでないと判断できないので、
   * ここでは生の値のまま受ける。
   */
  type DashboardScreenProps = {
    axisParam: string | string[] | undefined;
    periodParam: string | string[] | undefined;
    debtParam: string | string[] | undefined;
  };

  /**
   * B1が表示できないときの扱い。文言と、その場でやり直す意味があるかを1組で持つ。
   *
   * 2つを別々に決めると、失敗理由を足したときに片方だけ直して文言と導線が食い違う。
   */
  type DashboardFailureView = {
    message: string;
    /** `false`のときは再試行の導線を出さない(押しても同じ結果にしかならない失敗) */
    retryable: boolean;
  };

  /** 分類軸・表示期間の切替UIのProps */
  type DashboardFiltersProps = {
    axes: AssetCategoryAxis[];
    selectedAxisId: string;
    selectedPeriodId: DashboardPeriodId;
    /**
     * 選択中の資産推移の表示。この切替UI自体は出さない(切替は資産推移カードの中にある)が、
     * 分類軸・表示期間を変えたときに載せ直さないとURLから落ちてしまうため受け取る。
     */
    selectedTrendMode: NetWorthTrendModeId;
  };

  /** 資産推移グラフ(純資産表示)のProps */
  type NetWorthTrendChartProps = {
    /** 系列名。分類軸の名前をそのまま使う */
    axisName: string;
    series: NetWorthPoint[];
  };

  /** 資産推移グラフ(積み上げ表示)のProps */
  type NetWorthStackedChartProps = {
    /** 描く順(=色スロット順)に並んだ帯 */
    bands: NetWorthTrendBand[];
    points: NetWorthStackedPoint[];
  };

  /** 分類別内訳(円グラフ)のProps */
  type CategoryBreakdownChartProps = {
    slices: AssetBreakdownSlice[];
  };

  /** FIRE達成度ゲージのProps */
  type FireProgressGaugeProps = {
    /** 達成率(0〜1)。1を超える場合もそのまま渡す */
    achievementRate: number;
  };

  /** 資産推移カードのProps */
  type NetWorthTrendCardProps = {
    /** 見出しに添える分類軸の名前 */
    axisName: string;
    /** 表示期間で絞り込み済みの推移 */
    series: NetWorthPoint[];
    /** 選択中の切替(負債反映 / 資産のみ) */
    mode: NetWorthTrendModeId;
    /** 色スロットの割り当ての元になる分類の一覧(円グラフと共有する) */
    categories: AssetCategory[];
    /**
     * 切替を切り替えたときの遷移先を組み立てる。
     *
     * カード側に分類軸IDと表示期間を持たせないための受け渡し。切替でこの2つが
     * URLから落ちてはいけないが、それはカードの関心事ではない。
     */
    buildHref: (mode: NetWorthTrendModeId) => string;
  };

  /** 分類別内訳カードのProps */
  type CategoryBreakdownCardProps = {
    /** 見出しに添える分類軸の名前 */
    axisName: string;
    slices: AssetBreakdownSlice[];
    /**
     * 差引後の純額(対象の資産合計 - 対象の負債合計)。負債を含まない分類軸は`null`。
     *
     * 負債のスライスを置くと構成比の分母が「資産合計 + 負債合計」になり、%が純資産に
     * 対する割合ではなくなる。そのことが分かるよう、負債を含む軸でだけ純額を併記する
     * (docs/screen-requirements-dashboard.md B1)。
     */
    netAmount: number | null;
  };

  /** FIRE達成度カードのProps */
  type FireProgressCardProps = {
    /** 目標未設定なら`null` */
    fireProgress: FireProgress | null;
  };

  /** 収支サマリカードのProps */
  type CashflowSummaryCardProps = {
    /** 入出金明細が未取込なら`null` */
    cashflow: CashflowSummary | null;
  };

  /** 各ウィジェットのカードに共通する、データが無いときの表示のProps */
  type DashboardEmptyStateProps = {
    message: string;
    /** 空を解消するための導線。省略時はメッセージのみ */
    action?: {
      label: string;
      href: string;
    };
  };
}
