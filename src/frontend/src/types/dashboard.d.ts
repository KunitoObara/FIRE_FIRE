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
    amount: number;
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
    breakdown: AssetBreakdownEntry[];
  };

  /** FIRE達成度ゲージの表示値。目標未設定なら`null`が渡る */
  type FireProgress = {
    targetAmount: number;
    currentAmount: number;
    /**
     * 到達予測日(`yyyy-MM-dd`)。想定利回り(B9)を前提に算出するため、
     * B1では計算せず算出済みの値を表示するだけにする。未算出は`null`
     */
    projectedAchievementDate: string | null;
  };

  /** 収支サマリの費目別支出の1行 */
  type ExpenseByCategory = {
    name: string;
    amount: number;
  };

  /** 収支サマリ(当月) */
  type CashflowSummary = {
    /** 対象月(`yyyy-MM`) */
    month: string;
    income: number;
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
  };

  /** 資産推移グラフのProps */
  type NetWorthTrendChartProps = {
    /** 系列名。分類軸の名前をそのまま使う */
    axisName: string;
    series: NetWorthPoint[];
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
  };

  /** 分類別内訳カードのProps */
  type CategoryBreakdownCardProps = {
    /** 見出しに添える分類軸の名前 */
    axisName: string;
    slices: AssetBreakdownSlice[];
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
