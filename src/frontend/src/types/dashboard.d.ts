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
    /**
     * その時点で分類軸が加える不動産の額(物件ごとに利ざや または 時価の合計)。
     * **不動産の帯が描く値**(docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
     *
     * 負債と同じ理由で明示的に持つ — `byType`の総和と`amount`の差からは、負債と不動産の
     * どちらの分なのかを分けられない。オーバーローンの物件では**負になりうる**(0で止めない)。
     * 最新点だけは履歴ではなく現在の時価・ローン残高(同要件「いま」の扱い)。
     */
    propertyAmount: number;
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
    /**
     * B9で置いたリスクレベル。凡例に形状と文字で添える
     * (docs/screen-requirements-dashboard.md B1「リスクの可視化」)。
     *
     * **`null`は「添えるものが無い」**で、未設定の資産種別・B9の取得に失敗した場合・
     * 擬似分類(その他 / 不動産 / 負債)のすべてがここに入る。擬似分類に付かないことを
     * スライスを組み立てる時点で決めておくと、凡例の側が分類の種類を判定せずに済む。
     */
    riskLevel: AssumptionRiskLevel | null;
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
    /**
     * この分類軸が加える不動産の額の合計(現在の時価・ローン残高から)。
     *
     * 不動産を含まない分類軸は0。円グラフの不動産スライスと、純額の併記に使う
     * (docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
     * オーバーローンの物件だけを含む軸では負になりうる。
     */
    propertyTotal: number;
    /**
     * この分類軸が**利ざやで反映している物件を持つか**。
     *
     * 資産推移グラフの「資産のみ」に切り替えても、利ざやの物件はローン控除後の額のまま
     * 積まれる(切替が動かすのはB11の負債だけ)。0の線より上だけを見て「借入を一切引いて
     * いない状態」と読まれないよう、注記を出すかどうかの判定に使う
     * (docs/screen-requirements-dashboard.md B1「負債反映の切替との関係」)。
     *
     * 反映方法は分類軸が持つ設定なので、推移の点(`propertyAmount`)からは判定できない。
     */
    hasSpreadProperty: boolean;
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
     * 到達予測(docs/screen-requirements-fire-goal.md「到達予測日の算出」)。
     *
     * `null`は**前提の解決そのものに失敗した**場合(B9の想定値を取得できなかった)だけで、
     * 画面には「算出できません」が出る。目標未設定や資産残高の未取込はここに来ない
     * (前者はカードごと空状態、後者は0円から予測する)。
     */
    projection: FireProjection | null;
  };

  /**
   * 到達予測の結果(docs/screen-requirements-fire-goal.md「結果の区別」)。
   *
   * **状態は3つ。** 「目標に達する月」と「設定した結果として届かない」を同じ空欄で表すと
   * 区別が付かず、ユーザーが次に取る行動を選べないため、届かないことも状態として持つ。
   */
  type FireProjection =
    /** 目標に達する月が求まった。`achievementDate`は`yyyy-MM-dd`(表示は年月まで) */
    | { status: "projected"; achievementDate: string }
    /** 現在資産額が既に目標資産額以上 */
    | { status: "achieved" }
    /** 打ち切り月(`PROJECTION_MAX_MONTHS`)まで進めても目標に届かない */
    | { status: "unreachable" };

  /**
   * 予測の出発点。**成長させる分と据え置く分に分けて持つ**
   * (`resolveProjectionBase`)。
   *
   * 2つの合計は、その対象分類の現在資産額(`resolveAchievementAmount`)と一致する。
   */
  type FireProjectionBase = {
    /** 資産種別名ごとの残高。B9の想定利回りで月次に成長させる */
    balancesByType: Record<string, number>;
    /** 全期間据え置く額(対象の物件の額 − 対象の負債の残債。既定では合計と内訳の差額) */
    flatAmount: number;
  };

  /** 到達予測の算出に必要な入力一式 */
  type FireProjectionInput = FireProjectionBase & {
    /** 目標資産額(円)。0以下はここに来ない(呼び出し側がカードごと空状態にする) */
    targetAmount: number;
    /** 毎月の積立額(円)。マイナスは取り崩し。**利回りは掛けない**(B8) */
    monthlyContribution: number;
    /** 資産種別ごとの想定利回り・リスク(B9)。未設定の資産種別は年率0%として扱う */
    assumptions: AssetAssumptions;
    /** 起点(当月)。月をまたぐ瞬間のずれを避けるため、呼び出し側が1度だけ作って渡す */
    now: Date;
  };

  /**
   * FIRE達成度の組み立て(`buildFireProgress`)の入力。
   *
   * 引数が7つに増えたためオブジェクトで受ける。配列が3つ並ぶ位置引数は、渡す順を
   * 取り違えても型が通ってしまう(`debts`と`properties`以外は要素の型が違うので気付けるが、
   * 気付けない組み合わせを残す理由が無い)。
   */
  type BuildFireProgressInput = {
    /** 保存済みのFIRE目標(B8)。未設定は`null` */
    goal: FireGoal | null;
    /** 直近の資産残高。CSV未取込は`undefined` */
    latest: AssetSnapshot | undefined;
    /** 分類軸の一覧。対象分類がB4で削除されていた場合の既定へのフォールバックに使う */
    axes: AchievementAxisOption[];
    debts: Debt[];
    properties: RealEstateProperty[];
    /** B9の想定値。**取得に失敗した場合は`null`**で、予測だけを「算出できません」に倒す */
    assumptions: AssetAssumptions | null;
    /** 予測の起点(当月) */
    now: Date;
  };

  /**
   * 費目別支出の円グラフの1スライス(B1の収支サマリ)。
   *
   * `AssetBreakdownSlice`と形は同じだが別の型にする。あちらは資産分類マスタ(B4)の登録順に
   * 紐づく色を持ち、負債の擬似スライスも入りうる。費目はマスタを持たず(同書6章)、色は
   * **選択中の月に現れる費目の名前順**で決まるので、同じ型として扱うと取り違えても
   * 気付けない(docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。
   */
  type ExpenseBreakdownSlice = {
    /**
     * 費目名そのもの。溢れた分をまとめるスライスだけ擬似的なID
     * (`OTHER_EXPENSE_CATEGORY_ID`)で、表示名との一致では判定しない —
     * マネーフォワードの大項目には「その他」が実在する
     */
    categoryId: string;
    name: string;
    /** 0以上(`ExpenseByCategory`の取り決めをそのまま引き継ぐ) */
    amount: number;
    /** その月の支出合計に対する割合(0〜1) */
    ratio: number;
    color: string;
  };

  /** 費目別支出の円グラフのProps */
  type ExpenseBreakdownChartProps = {
    /** 描く順(=色スロット順=費目名順)に並んだスライス */
    slices: ExpenseBreakdownSlice[];
  };

  /** 収支サマリの費目別支出の1行(費目は大項目。粒度は同書6章) */
  type ExpenseByCategory = {
    name: string;
    /** **0以上。** 支出は絶対値で持つ(`CashflowSummary`の取り決め) */
    amount: number;
  };

  /**
   * 収支サマリ(選択中の年月)。
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
    /** 対象月(`yyyy-MM`)。呼び出し側が選んだ月そのもので、集計の中でも導かない */
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
    /**
     * B9で置いた資産種別ごとの想定値。分類別内訳の凡例のリスクレベルに使う
     * (docs/screen-requirements-dashboard.md B1「リスクの可視化」)。
     *
     * **取得に失敗した場合は空のレコードにする。** 到達予測は前提が無いことを
     * 「算出できません」で示せるが、凡例には示す場所が無く、示す必要も無い
     * (リスクを1件も設定していない状態と見た目が同じになるだけ)。
     */
    assumptions: AssetAssumptions;
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
   * 収支サマリの取得結果(`fetchCashflowData`)。
   *
   * ダッシュボードの一括取得とは別に持つ。対象の月は画面上で選べるので、混ぜると年月を
   * 切り替えるたびに資産残高・分類軸・負債・FIRE目標まで読み直すことになる
   * (docs/screen-requirements-dashboard.md B1「年月の選択」)。
   *
   * **「その月に取引が無い」は失敗ではない**ので、`cashflow: null`を`ok: true`で返す。
   * 月初や取り込んでいない過去の月では正常に起こる状態で、失敗は取得そのものが
   * できなかった場合だけを指す。
   */
  type CashflowDataResult =
    | { ok: true; cashflow: CashflowSummary | null }
    | { ok: false; reason: FirestoreAccessFailureReason };

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
    /** 収支サマリの対象月(`yyyy-MM`)。未指定・不正な値・当月より後は当月に落とす */
    monthParam: string | string[] | undefined;
  };

  /**
   * B1のURLに載せる選択の一式(`buildDashboardHref`)。
   *
   * **4つとも必ず載せる。** 1つだけを変えたときに他の選択が落ちないようにするため。
   * 位置引数ではなくオブジェクトで受けるのは、`string`が隣り合う引数の順番を取り違えても
   * 型で気付けないため。
   */
  type DashboardHrefParams = {
    axisId: string | undefined;
    periodId: DashboardPeriodId;
    trendMode: NetWorthTrendModeId;
    /** 収支サマリの対象月(`yyyy-MM`) */
    month: string;
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
     * 選択中の収支サマリの対象月。この切替UI自体は出さない(年月ピッカーは収支サマリの
     * カードの中にある)が、分類軸・表示期間を変えたときに載せ直さないとURLから落ちる。
     * `selectedTrendMode`と同じ理由で受け取る。
     */
    selectedMonth: string;
    /**
     * 選択中の資産推移の表示。この切替UI自体は出さない(切替は資産推移カードの中にある)が、
     * 分類軸・表示期間を変えたときに載せ直さないとURLから落ちてしまうため受け取る。
     */
    selectedTrendMode: NetWorthTrendModeId;
  };

  /** 資産推移グラフ(積み上げ)のProps */
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
    /** 利ざやで反映している物件があるか。「資産のみ」の注記を出すかの判定に使う */
    hasSpreadProperty: boolean;
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

  /**
   * 収支サマリカードのProps。
   *
   * **集計済みのデータは受け取らない。** 対象の月ごとに取得するのはカード自身で、
   * ダッシュボードの一括取得から切り離してある(docs/screen-requirements-dashboard.md B1
   * 「年月の選択」)。
   */
  type CashflowSummaryCardProps = {
    /** 表示中の対象月(`yyyy-MM`) */
    month: string;
    /** 選べる上限(`yyyy-MM`。当月)。呼び出し側と同じ時刻から導いた値を渡す */
    maxMonth: string;
    onMonthChange: (month: string) => void;
  };

  /** 年月ピッカーのProps */
  type MonthPickerProps = {
    /** 選択中の年月(`yyyy-MM`)。空文字は「未設定」を表す(`clearable`な呼び出し側のみ渡しうる) */
    month: string;
    /** これより後の月は選べない(`yyyy-MM`) */
    maxMonth: string;
    /** トリガーボタンの読み上げ名。呼び出し側の文脈(B1「対象の年月」・B7「取得年月」等)で変わる */
    label: string;
    /** トリガーボタンのid。外側の`<FieldLabel htmlFor>`と対応させたい呼び出し側だけ渡す */
    id?: string;
    /** trueのとき「未設定に戻す」を出す。未入力を許す欄(B7取得年月・B11発生年月)向け */
    clearable?: boolean;
    disabled?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    onSelect: (month: string) => void;
    /**
     * `Controller`経由で使う呼び出し側(B7・B11)が`field.onBlur`を渡す。react-hook-formの
     * `mode: "onTouched"`はこれが呼ばれて初めて「touched」を付けるため、渡さないと
     * インライン検証が(未来月を選べないこと以外の理由で赤くなる場合でも)保存を押すまで出ない
     * (B9リスクレベルSelectの`Controller`と同じ理由でここも配線する)。
     */
    onBlur?: () => void;
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
