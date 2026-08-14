/** B1 ダッシュボード画面で使う定数 */

import {
  ASSET_CATEGORIES_PATH,
  ASSUMPTION_SETTINGS_PATH,
  CSV_IMPORT_PATH,
  DEBTS_PATH,
  FIRE_GOAL_PATH,
  TRANSACTIONS_PATH,
} from "@/constants/routes";

/** 表示期間切替の選択肢(docs/screen-requirements-dashboard.md B1) */
export const DASHBOARD_PERIODS: DashboardPeriod[] = [
  { id: "1y", label: "1年", years: 1 },
  { id: "3y", label: "3年", years: 3 },
  { id: "5y", label: "5年", years: 5 },
  { id: "all", label: "全期間", years: null },
];

/** 表示期間の既定値 */
export const DEFAULT_DASHBOARD_PERIOD_ID: DashboardPeriodId = "1y";

/**
 * 分類軸・表示期間をURLに載せるときのクエリパラメータ名。
 * リンク共有・ブラウザの戻る/進むで同じ表示を再現するため、これらはURLに持たせる
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
export const DASHBOARD_AXIS_PARAM = "axis";
export const DASHBOARD_PERIOD_PARAM = "period";
export const DASHBOARD_DEBT_PARAM = "debt";
export const DASHBOARD_MONTH_PARAM = "month";

/**
 * 年月を表す文字列の形(`date-fns`の書式)。
 *
 * 収支サマリの対象月(`CashflowSummary.month`・URLの`month`)と、資産残高を月へ丸めるときに
 * 共有する。B11の発生年月(`DEBT_ORIGINATED_ON_PATTERN`)と同じ`yyyy-MM`だが、あちらは
 * 入力値の検査用の正規表現で、これは整形・パースの書式なので別に持つ。
 */
export const MONTH_KEY_FORMAT = "yyyy-MM";

/**
 * 資産推移グラフの負債反映切替の選択肢(docs/screen-requirements-dashboard.md B1)。
 *
 * グラフは常に資産種別の積み上げで、切替が動かすのは**負債を反映するかどうかだけ**。
 * ON/OFFのスイッチ1つにせず2択のタブにするのは、スイッチだとOFF側が何を描く状態なのかが
 * ラベルから読めず、同じカードに並ぶ表示期間の切替とも操作の形が変わるため(同節)。
 */
export const NET_WORTH_TREND_MODES: NetWorthTrendMode[] = [
  { id: "with-debt", label: "負債反映" },
  { id: "assets-only", label: "資産のみ" },
];

/**
 * 負債反映の既定値。
 *
 * **既定はON。** 分類軸に負債を選んでいること自体が「この軸では負債を差し引いて見たい」
 * という設定であり(B4)、既定OFFだとB4でチェックした結果が初期表示に出ない。負債を
 * 1件も選んでいない分類軸ではONでも描くものが増えないので、既定の違いは現れない
 * (docs/screen-requirements-dashboard.md B1「資産推移グラフの負債反映切替」)。
 */
export const DEFAULT_NET_WORTH_TREND_MODE_ID: NetWorthTrendModeId = "with-debt";

/** 切替のアクセシブルな名前(タブの見た目に対する説明) */
export const NET_WORTH_TREND_MODE_LABEL = "負債の反映";

/**
 * 積み上げ表示の正負の積み方(Rechartsの`stackOffset`)。
 *
 * **正を0より上・負を0より下に分けて積む。** 既定の`"none"`は順にそのまま累積するため、
 * マイナス残高の資産種別の帯が直前の帯に重なって下向きに描かれ、帯の切れ目が読めなくなる
 * (docs/screen-requirements-dashboard.md B1「積み上げ表示」)。
 *
 * この積み方では面の上端は「正の資産種別だけの合計」になる。ツールチップの合計とは
 * 一致しないことがあり、それは意図した通り(同節)。
 */
export const NET_WORTH_STACK_OFFSET = "sign";

/** 積み上げ表示のツールチップに出す合計の見出し */
export const NET_WORTH_STACK_TOTAL_LABEL = "合計";

/**
 * 負債反映OFFのあいだに出す注記。
 *
 * 隣の円グラフは負債のスライスと差引後の純額を出し続けるので、これが無いと同じ画面の
 * 2つのグラフが同じ分類軸について違う合計を示しているように見える(同要件B1)。
 */
export const STACKED_DEBT_NOT_DEDUCTED_NOTICE =
  "この分類軸が対象にしている負債は反映していません。「負債反映」に切り替えると、差し引いた推移が見られます。";

/**
 * 負債の帯に重ねるハッチング(斜線)。円グラフの負債スライスと同じ見た目にする
 * (DESIGN.md 3章)。
 *
 * 帯は0の線を挟んで資産の帯と隣り合い、マイナス残高の資産種別の帯とも並ぶため、色だけでは
 * 「マイナス残高の資産種別」と区別が付かない。円グラフと同じくSVGの`<pattern>`で描くので、
 * 参照するIDをここで固定する(**円グラフとは別のIDにする** — 同じ画面に2つのSVGが並び、
 * 同じIDの`<pattern>`が2つあると、どちらを参照するかがDOMの順序で決まってしまう)。
 */
export const DEBT_BAND_HATCH_PATTERN_ID = "net-worth-trend-debt-hatch";

/**
 * 分類別内訳で個別の色を割り当てられる分類の数。
 * `globals.css`の`--chart-1`〜`--chart-8`と一致させる。
 */
export const CATEGORY_COLOR_SLOT_COUNT = 8;

/** 色のスロットに収まらなかった分類をまとめる表示名 */
export const OTHER_CATEGORY_NAME = "その他";

/** 色のスロットに収まらなかった分類をまとめる際の擬似的な分類ID */
export const OTHER_CATEGORY_ID = "__other__";

/**
 * 収支サマリの費目別支出で、色のスロットに収まらなかった費目をまとめるスライス
 * (docs/screen-requirements-dashboard.md B1「費目別支出の円グラフ」)。
 *
 * **表示名を資産側の「その他」と別にする**(PO判断)。費目名はマネーフォワードのCSVの値そのもので
 * (docs/transaction-import-requirements.md 6章)、大項目には**「その他」が実在する**。同じ名前を
 * 受け皿に使うと、費目が9件以上ある月に凡例へ「その他」が2行並び、どちらが何を指すのかが
 * 画面から読めなくなる。避けられるのはアプリ側が付ける名前だけなので、そちらを変える。
 *
 * IDが擬似的なのは資産側と同じ理由 — 判定は`OTHER_EXPENSE_CATEGORY_ID`で行い、表示名との
 * 一致では見ない。
 */
export const OTHER_EXPENSE_CATEGORY_ID = "__other-expense__";
export const OTHER_EXPENSE_CATEGORY_NAME = "ほかの費目";

/**
 * 分類別内訳の負債スライスを表す擬似的な分類ID(`OTHER_CATEGORY_ID`と同じ考え方)。
 *
 * **表示名「負債」との一致で判定しない。** 資産種別の名前はCSVの列名そのもの
 * (要件定義書 4.3)なので「負債」という名前の資産種別が現れうるし、名前による分岐は
 * 分類軸をハードコードしない方針にも反する(docs/screen-requirements-dashboard.md B1)。
 */
export const DEBT_CATEGORY_ID = "__debt__";

/** 分類別内訳の負債スライスの表示名。項目ごとに分けず1つにまとめる(項目別はB1の負債サマリとB11で見る) */
export const DEBT_CATEGORY_NAME = "負債";

/**
 * 負債スライスの色。**資産分類カラーのスロット(`--chart-1`〜`--chart-8`)を使わない**
 * (DESIGN.md 3章)。
 *
 * 負債がスロットを1つ占めると、実際に保有している資産の分類が「その他」へ押し出される。
 * 負債は分類軸ごとに1スライスに固定なので、スロットを配る対象にする必要がない。
 * 赤(`--destructive`)を当てるのは、負の値を赤で表す会計上の慣用に沿うため。
 */
export const DEBT_CATEGORY_COLOR = "var(--destructive)";

/**
 * 負債のスライスに重ねるハッチング(斜線)。**隣り合うスライスの色相にかかわらず常に重ねる**
 * (DESIGN.md 3章)。
 *
 * 負債は最後のスライスなので円グラフでは12時の位置で1色目と必ず隣り合うが、そこに何色が
 * 来るかは分類軸ごとの登録順で決まり、`--chart-*`の値も後から調整されうる。「今のパレットでは
 * 色相が離れているから不要」という判断にすると、パレットを触ったときに見分けにくい
 * 組み合わせが黙って生まれる。色以外の手がかりを併用する方針はリスクレベル(B9)と同じ。
 *
 * 円グラフ側はSVGの`<pattern>`で描くため、参照するIDをここで固定する。
 */
export const DEBT_SLICE_HATCH_PATTERN_ID = "category-breakdown-debt-hatch";

/**
 * 凡例の色見本に重ねるハッチング。円グラフのスライスと同じ見た目にする
 * (見本とスライスの見た目が違うと対応が取れない。DESIGN.md 3章)。
 *
 * SVGの`<pattern>`はグラフのSVGの中にしか無いので、凡例はCSSのグラデーションで同じ
 * 斜線を作る。角度と間隔を`DEBT_SLICE_HATCH_*`と揃えてある。
 */
export const DEBT_LEGEND_SWATCH_BACKGROUND =
  "repeating-linear-gradient(45deg, var(--destructive) 0 2px, color-mix(in oklab, var(--destructive) 55%, white) 2px 4px)";

/**
 * 分類別内訳・積み上げ推移グラフの不動産を表す擬似的な分類ID(`DEBT_CATEGORY_ID`と同じ考え方)。
 *
 * **表示名「不動産」との一致で判定しない。** 資産種別の名前はCSVの列名そのものなので
 * 「不動産」という名前の資産種別が現れうる — マネーフォワードに不動産を登録していれば
 * むしろ現れる(docs/screen-requirements-dashboard.md B1「CSV取込データとの重複」)。
 */
export const PROPERTY_CATEGORY_ID = "__property__";

/** 不動産のスライス・帯の表示名。物件ごとに分けず1つにまとめる(物件別はB5・B6で見る) */
export const PROPERTY_CATEGORY_NAME = "不動産";

/**
 * 不動産の色。**資産分類カラーのスロットを使わない**(DESIGN.md 3章)。
 *
 * 物件の数だけスロットを占めると、実際に保有している資産種別が「その他」へ押し出される
 * (負債と同じ理由)。`--real-estate`は`--chart-*`とも`--destructive`とも別のトークン。
 */
export const PROPERTY_CATEGORY_COLOR = "var(--real-estate)";

/**
 * 不動産のスライス・帯に重ねる模様(点)。**負債のハッチング(斜線)とは変える**
 * (DESIGN.md 3章)。
 *
 * 利ざやがマイナスの物件では帯が0の線より下に積まれ、負債の帯と並ぶ。そこで模様まで
 * 同じだと、色相の違いだけで「不動産」と「負債」を見分けることになる。
 */
export const PROPERTY_SLICE_DOT_PATTERN_ID = "category-breakdown-property-dot";

/** 凡例の色見本に重ねる点。円グラフのスライスと同じ見た目にする(負債の色見本と同じ考え方) */
export const PROPERTY_LEGEND_SWATCH_BACKGROUND =
  "radial-gradient(color-mix(in oklab, var(--real-estate) 45%, white) 30%, transparent 32%) 0 0 / 4px 4px, var(--real-estate)";

/**
 * 差引後の純額に添える見出し(分類別内訳のカード)。
 *
 * 円グラフは正の面積でしか比を表せず、負債のスライスを置いた時点で**構成比の分母は
 * 「対象の資産合計 + 対象の負債合計」**になる。%が純資産に対する割合ではないことが
 * 分かるよう、差引後の純額を数字で併記する(docs/screen-requirements-dashboard.md B1)。
 */
export const BREAKDOWN_NET_AMOUNT_LABEL = "資産 - 負債";

/**
 * 不動産を含む分類軸での純額の見出し。
 *
 * 加える側(不動産)と引く側(負債)が並ぶので、式の順どおりに出す
 * (docs/screen-requirements-dashboard.md B1「不動産を含む分類軸の集計」)。
 */
export const BREAKDOWN_NET_AMOUNT_WITH_PROPERTY_LABEL = "資産 + 不動産 - 負債";

/**
 * 「資産のみ」に切り替えても不動産はローン控除後のままである旨の注記(B1)。
 *
 * 負債反映の切替が動かすのはB11の負債だけで、不動産は分類軸の設定どおりに積まれ続ける。
 * 0の線より上だけを見て「借入を一切引いていない状態」と読まれないようにする。
 * **利ざやで反映している物件がある分類軸にだけ**出す。
 */
export const PROPERTY_SPREAD_NOT_TOGGLED_NOTICE =
  "「利ざやのみ反映」にしている物件は、「資産のみ」でもローンを差し引いた額で積まれています。切替はこの分類軸が対象にしている負債だけに効きます。";

/** 直近CSV取込日時が無いときの表示 */
export const NO_CSV_IMPORT_LABEL = "CSV未取込";

/** 各ウィジェットの空状態(docs/screen-requirements-dashboard.md B1の各表示項目に対応) */
export const DASHBOARD_EMPTY_STATES = {
  netWorth: {
    message: "資産残高のデータがまだありません。CSVを取り込むと推移が表示されます。",
    action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
  },
  breakdown: {
    message: "この分類軸に集計対象の資産がありません。分類の設定を確認してください。",
    action: { label: "資産分類を設定する", href: ASSET_CATEGORIES_PATH },
  },
  fireProgress: {
    message: "FIRE目標が未設定です。目標を設定すると達成度と到達予測日が表示されます。",
    action: { label: "目標を設定する", href: FIRE_GOAL_PATH },
  },
} as const;

/**
 * 選択した年月に取引が1件も無いときの案内(docs/screen-requirements-dashboard.md B1
 * 「選択した年月にデータが無いとき」)。
 *
 * **「まだ取り込んでいない」と言い切らない。** 読むのは選択中の1ヶ月だけなので
 * (docs/transaction-import-requirements.md 8章)、他の月に取引があるかどうかをこの画面は
 * 知らない。月初や取り込んでいない過去の月を選んだときに正常に起こる状態であり、
 * 断定するとその月しか取り込んでいないユーザーに「無い」と伝えることになる
 * (B3の`NO_TRANSACTIONS_IN_PERIOD_EMPTY_STATE`と同じ理由)。
 *
 * 別の月を選ぶ手はカードの中の年月ピッカーそのものなので、文言で示してCSV取込を導線に置く。
 */
export const buildCashflowEmptyState = (
  monthLabel: string,
): { message: string; action: { label: string; href: string } } => ({
  message: `${monthLabel}の取引がありません。別の月を選ぶか、入出金明細CSVを取り込んでください。`,
  action: { label: "CSVを取り込む", href: CSV_IMPORT_PATH },
});

/**
 * 取引はあるが支出が1件も無い月に、費目別支出の場所へ出す文言(同節)。
 *
 * この月を空状態にはしない。収入・支出・収支の3つの数字は出したうえで費目別支出だけを
 * 出さないので、**空欄のまま詰めると「支出が無い」のか「表示が壊れている」のかが
 * 画面から区別できない**。全額が振替・計算対象外だった月に普通に起こる状態であり、
 * 取引は取り込めているので導線は添えない。
 */
export const NO_EXPENSE_IN_MONTH_LABEL = "この月の支出はありません。";

/** 年月ピッカーのアクセシブルな名前(見えている月の表示に添える) */
export const CASHFLOW_MONTH_PICKER_LABEL = "対象の年月";

/** 年月ピッカーの年送りのラベル。上限は当月なので、当年を表示中は「次の年」を押せない */
export const CASHFLOW_MONTH_PICKER_PREVIOUS_YEAR_LABEL = "前の年";
export const CASHFLOW_MONTH_PICKER_NEXT_YEAR_LABEL = "次の年";

/**
 * 負債サマリに並べる項目の件数。超過分は「ほかN件」にまとめてB11へ渡す
 * (docs/screen-requirements-dashboard.md B1「負債サマリ」)。
 * ダッシュボードのカードは俯瞰のための場所で、全件を並べる場所ではB11がある。
 */
export const DEBT_SUMMARY_ROW_LIMIT = 5;

/**
 * 負債が1件も登録されていないときの案内。負債が無いこと自体はエラーではない。
 *
 * 導線のラベルはカード見出しの「負債を入力する」とあえて変える。同じ文言のリンクが
 * 縦に2つ並ぶと別の操作があるように見えるため(B5の空状態と同じ扱い)。
 */
export const DEBT_SUMMARY_EMPTY_STATE = {
  message: "負債がまだ登録されていません。登録するとここに残債が並びます。",
  action: { label: "負債を登録する", href: DEBTS_PATH },
} as const;

/** 分類軸が1つも登録されていないときの案内 */
export const NO_ASSET_AXIS_EMPTY_STATE = {
  message: "分類軸が登録されていません。資産分類マスタで分類軸を追加してください。",
  action: { label: "資産分類を設定する", href: ASSET_CATEGORIES_PATH },
} as const;

/** 収支サマリから収支明細一覧(B3)への導線 */
export const CASHFLOW_DETAIL_LINK = { label: "詳細を見る", href: TRANSACTIONS_PATH } as const;

/** FIRE達成度ゲージからFIRE目標設定(B8)への導線 */
export const FIRE_GOAL_LINK = { label: "目標を設定する", href: FIRE_GOAL_PATH } as const;

/** 「CSVを取り込む」ボタンの導線 */
export const CSV_IMPORT_LINK = { label: "CSVを取り込む", href: CSV_IMPORT_PATH } as const;

/**
 * 達成度の対象分類(B8)に設定していた分類軸がB4で削除されていたときの注意書き。
 *
 * 既定(総資産)で計算したうえでこれを出す。ゲージを消したり達成率0%にしたりはしない
 * (docs/screen-requirements-dashboard.md B1)。設定し直す先はB8なので、カードに元から
 * ある`FIRE_GOAL_LINK`がそのまま導線になる。
 */
export const ACHIEVEMENT_AXIS_MISSING_NOTICE =
  "設定していた対象分類が見つからないため、総資産で計算しています。";

/**
 * 現在資産額がマイナス(負債が資産を上回る)のときにゲージのカードへ添える注記。
 *
 * 達成率は0%に丸めるが、0%は「まだ何も貯まっていない」状態でも出る値なので、
 * 注記が無いと両者を区別できない(docs/screen-requirements-dashboard.md B1)。
 * 現在資産額そのものはマイナスのまま出すので、金額と読み合わせられる。
 */
export const NEGATIVE_CURRENT_AMOUNT_NOTICE =
  "対象分類の負債が資産を上回っているため、達成率は0%として表示しています。";

/**
 * 到達予測日が算出できていないときの表示。
 *
 * **通常の運用では出ない。** 目標未設定ならカードごと空状態になって欄が現れず、資産残高が
 * 未取込でも0円から予測を始める(docs/screen-requirements-fire-goal.md「到達予測日の算出」)。
 * 残るのは前提の解決そのものに失敗した場合(B9の想定値を取得できなかった)の保険としての用途。
 */
export const NO_PROJECTED_DATE_LABEL = "算出できません";

/** 現在資産額が既に目標資産額以上のときの表示。過去日付や0ヶ月を出さずにこの文言へ倒す */
export const ACHIEVED_PROJECTION_LABEL = "達成済み";

/** 打ち切り月まで進めても目標に届かないときの表示 */
export const UNREACHABLE_PROJECTION_LABEL = "到達見込みなし";

/**
 * 予測を打ち切る月数(50年)。
 *
 * 上限を置かないと、資産がまったく増えない設定で終わらない(同要件「結果の区別」)。
 * **この月に到達した場合は到達側に倒す** — 打ち切りは「ここまで進めても届かない」ことを
 * 見込みなしと呼ぶための線であって、届いた月を捨てるためのものではない。
 */
export const PROJECTION_MAX_MONTHS = 600;

/**
 * 「到達見込みなし」に添える注記。
 *
 * 原因は想定利回り(B9)側とは限らず、積立額(B8)がマイナスで資産が減り続ける場合もあるため、
 * 片方に絞らず両方への導線を出す(docs/screen-requirements-dashboard.md B1「到達予測日」)。
 */
export const UNREACHABLE_PROJECTION_NOTICE = `現在の想定利回りと毎月の積立額では、${PROJECTION_MAX_MONTHS / 12}年以内に目標へ届きません。`;

/** FIRE達成度ゲージから想定利回り・リスク設定(B9)への導線 */
export const ASSUMPTION_SETTINGS_LINK = {
  label: "想定利回りを設定する",
  href: ASSUMPTION_SETTINGS_PATH,
} as const;

/**
 * 「到達見込みなし」から積立額(B8)を直しに行く導線の文言。
 *
 * 行き先はカード見出しの`FIRE_GOAL_LINK`と同じB8だが、あちらの「目標を設定する」は
 * 積立額を直す先には読めないため、ここでは何を直せるかが分かる文言にする。
 */
export const MONTHLY_CONTRIBUTION_LINK_LABEL = "積立額を見直す";

/**
 * グラフの登場アニメーションの再生時間(ms)と、その進み方(DESIGN.md 9章)。
 *
 * ログイン直後の最初の画面なので、資産状況の把握を待たせない長さに収める。
 * 3つのグラフで同じ値を使う。グラフごとに違う長さだと、同じ画面の中で別々に動いて見える。
 */
export const CHART_ANIMATION_DURATION_MS = 600;
export const CHART_ANIMATION_EASING = "ease-out";

/**
 * 資産推移グラフ・分類別内訳の再生の引き金にする、データの署名。
 *
 * 再生するのは**そのグラフ自身のデータが変わったとき**だけで、ホバー・リサイズ・
 * 同じデータのままの再レンダリングでは再生しない(DESIGN.md 9章)。この署名を
 * Reactの`key`に渡してコンポーネントを作り直すことで、その条件をそのまま表す。
 *
 * 配列の同一性(参照)では判定できない。表示データは取得のたびに組み立て直されるため、
 * 中身が同じでも参照は毎回変わり、再取得だけで再生してしまう。
 *
 * **全点を署名に含める。** 件数と両端だけでは、CSVを取り込み直して途中の月の残高だけが
 * 訂正された場合(件数も両端も変わらない)に線の形が変わったことを検出できず、再生が漏れる。
 * 点は月に1つで「全期間」でも数十個にしかならないため、全点を並べても負担にならない。
 *
 * **区切り文字での連結ではなく`JSON.stringify`で組む。** 分類軸名(B4でユーザーが付ける)や
 * 資産種別名(CSVの列名)は自由入力に近く、区切りに使った文字がそのまま値に現れうる。
 * 連結だと、中身の違う2つのデータが同じ署名に潰れて再生が漏れる。
 */
export const buildNetWorthSeriesKey = (
  axisName: string,
  series: NetWorthPoint[],
  mode: NetWorthTrendModeId,
): string =>
  JSON.stringify([
    axisName,
    mode,
    /*
      **`byType`も署名に含める。** 純額だけでは、CSVを取り込み直して内訳の配分だけが
      訂正された場合(合計は同じ)に積み上げの帯の形が変わったことを検出できず、再生が漏れる。

      **キーで並べ替えてから並べる。** `byType`はFirestoreのマップをそのまま持つので、
      同じ中身でも取得のたびにキーの順が変わりうる。順のまま署名にすると、中身が変わって
      いない裏での取り直しでも署名が変わり、DESIGN.md 9章が再生しないと定めている
      「データが変わらないままの再レンダリング」で再生してしまう。
    */
    series.map((point) => [
      point.date,
      point.amount,
      Object.entries(point.byType).sort(([left], [right]) => left.localeCompare(right)),
      /*
        **残債も署名に含める。** 負債の帯は`debtBalance`から描くので、これを含めないと
        「負債だけが更新されて資産は同じ」保存のあとに帯の形が変わったことを検出できない。
        切替(`mode`)自体は上で署名に入っており、帯の出入りはそちらで再生される
      */
      point.debtBalance,
      /*
        **不動産の額も同じ理由で含める。** 帯は`propertyAmount`から描くので、これを
        含めないと「時価を更新したが、同額の負債の増減と相殺されて純額は同じ」保存の
        あとに帯の形が変わったことを検出できない(残債と同じ性質の漏れ)
      */
      point.propertyAmount,
    ]),
  ]);

/**
 * FIRE達成度ゲージの再生の引き金。**固定値**で、初回描画時にしか再生しない(DESIGN.md 9章)。
 *
 * 資産推移・分類別内訳と違い、ゲージは「そのグラフのデータが変わったとき」でも再生しない。
 * 9章の再生条件の表が「初回描画時のみ。分類軸切替・表示期間切替では再生しない」と、他の2つの
 * 一般条件とは書き分けているため。達成率を引き金にすると、画面を開いたまま裏で取り直しが
 * 走って値が変わったとき(別タブでCSVを取り込み直した場合など)にもリングが0%から再生される。
 */
export const FIRE_GAUGE_ANIMATION_KEY = "fire-progress-gauge";

/** 分類別内訳の再生の引き金にする署名(`buildNetWorthSeriesKey`と同じ考え方) */
export const buildBreakdownKey = (axisName: string, slices: AssetBreakdownSlice[]): string =>
  JSON.stringify([axisName, slices.map((slice) => [slice.categoryId, slice.amount])]);

/**
 * 費目別支出の円グラフの再生の引き金にする署名。
 *
 * **選択中の年月を含める。** 費目と金額だけでは、内訳がたまたま同じ月へ切り替えたときに
 * 署名が変わらず、再生が漏れる(DESIGN.md 9章。年月切替は「切り替えた結果が変わったことを
 * 見せる」再生の対象)。分類軸切替・表示期間切替では再生しない — このカードはどちらにも
 * 追従しないので、そもそも中身が変わらない。
 */
export const buildExpenseBreakdownKey = (month: string, slices: ExpenseBreakdownSlice[]): string =>
  JSON.stringify([month, slices.map((slice) => [slice.categoryId, slice.amount])]);

/** ダッシュボードの表示データのキャッシュキー(TanStack Query) */
export const DASHBOARD_DATA_QUERY_KEY = ["dashboard-data"] as const;

/**
 * 収支サマリのキャッシュキー。**`DASHBOARD_DATA_QUERY_KEY`とは別に持つ**。
 *
 * **キーには対象の年月を足して使う**(`[...CASHFLOW_DATA_QUERY_KEY, month]`)。読む範囲が
 * 年月で変わるためで、月ごとに別のキャッシュに載ることで一度見た月へ戻ったときに
 * 読み直さない(B3が期間ごとに分けているのと同じ形)。
 *
 * ダッシュボードの一括取得と分けてあるのは、**年月を切り替えたときに読み直すのを
 * その月の取引だけにする**ため(docs/screen-requirements-dashboard.md B1「年月の選択」)。
 * 混ぜると資産残高・分類軸・負債・FIRE目標まで毎回引き直すことになる。
 *
 * B2で入出金明細を取り込んだあとの無効化は、このキーの前方一致で全ての月に効かせる。
 */
export const CASHFLOW_DATA_QUERY_KEY = ["cashflow-data"] as const;

/**
 * 収支サマリのキャッシュを新鮮とみなす時間。**一度見た月へ戻ったときに読み直さない**ための設定
 * (docs/screen-requirements-dashboard.md B1「年月の選択」)。
 *
 * TanStack Queryの既定(`staleTime: 0`)ではキャッシュを即座に出したうえで裏で取り直すため、
 * 月を行き来するたびにFirestoreを読むことになる。月ごとにキャッシュを分けた目的が
 * 「読み取りを増やさない」ことなので、その裏の再取得も止める。
 *
 * **古い数字が残り続けることにはならない。** 取引を書き換えるのはB2の取込だけで、そのとき
 * `CASHFLOW_DATA_QUERY_KEY`の前方一致で全ての月が無効化される(無効化は`staleTime`より優先され、
 * 表示中のクエリはその場で取り直される)。別のタブで取り込んだ場合だけはリロードまで反映されないが、
 * これはダッシュボードの一括取得(`DASHBOARD_DATA_QUERY_KEY`)も同じ性質で、本カードだけの制約ではない。
 */
export const CASHFLOW_DATA_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/**
 * 表示データを取得できなかったときの文言。
 *
 * 取得に失敗した場合はウィジェットの空状態を出さない。データはあるのに「まだありません」と
 * 読める表示になるのを避けるため、失敗は失敗として出す(B5 不動産一覧と同じ扱い)。
 */
export const DASHBOARD_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

/**
 * 表示データの組み立て自体が例外で落ちたときの文言。
 *
 * Firestoreの取得は理由付きの失敗として返るが、取得後の集計(日付の整形など)は
 * その外側で走るため、壊れた値が1件混じるだけで例外になる。原因はデータ側にあり
 * 再試行では直らないことが多いので、確認先まで添える。
 */
export const DASHBOARD_UNEXPECTED_ERROR_MESSAGE =
  "データを表示できませんでした。再試行しても直らない場合は、取り込んだCSVのデータに問題がある可能性があります。";

/** 取得をやり直すボタンの文言(A7の「再試行する」に合わせる) */
export const DASHBOARD_RETRY_LABEL = "再試行する";

/** 再試行の実行中に見せる文言 */
export const DASHBOARD_RETRYING_LABEL = "再試行中…";
