/** B3 収支明細一覧画面で使う定数 */

import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";
import { CSV_IMPORT_PATH } from "@/constants/routes";

/**
 * 取引一覧を**取得**できなかったときの文言。
 *
 * 取得の失敗を空状態(未取込)として見せないための文言で、B11の`DEBT_LOAD_FAILURE_MESSAGES`と
 * 同じ役目を持つ。画面ごとに持つのは、次にすべきことが画面によって変わりうるため。
 */
export const TRANSACTIONS_LOAD_FAILURE_MESSAGES: Record<FirestoreAccessFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

/**
 * 読み取りが`TRANSACTION_SCAN_LIMIT`件で打ち切られたときの案内
 * (docs/transaction-import-requirements.md 8章)。
 *
 * 黙って古い側が欠けると、一覧に無いことを「取り込んでいない」と読み違える。件数と、
 * 欠けたのがどちら側か(古い側)と、狭い期間を選べば全部見えることまでを添える。
 *
 * **何に対する件数なのかを取り違えさせない。** 打ち切りは**選択中の期間で読み取った件数**に
 * 対する判定で、費目・口座・キーワードの絞り込みには依存しない(絞り込みで分岐しないのが
 * 同章の求めるところ)。「該当する取引が多いため」と書くと、絞り込んでいる最中のユーザーには
 * 「絞り込み後の件数」の話に読める。表示中の件数と案内の数字が噛み合わないように見えると、
 * 打ち切りの案内そのものを疑わせることになる。
 */
export const buildTransactionsTruncatedNotice = (scanLimit: number): string =>
  `選択中の期間は取引が多いため、新しい方から${scanLimit.toLocaleString("ja-JP")}件だけを読み込んでいます。これより古い取引は表示されておらず、費目・口座・キーワードでの絞り込みもこの範囲に対して行われます。期間を狭めてください。`;

/**
 * B3が表示する取引データのキャッシュキー(TanStack Query)。
 *
 * B2で入出金明細を取り込んだ直後にこのキーを無効化する。取り込んだ取引はB3の一覧そのもので、
 * 戻ったときに古い内容を見せないため(docs/screen-requirements-dashboard.md B2
 * 「入出金明細タブ」。資産残高推移タブが`DASHBOARD_DATA_QUERY_KEY`を落としているのと同じ)。
 *
 * **キーには選択中の期間を足して使う**(`[...TRANSACTIONS_DATA_QUERY_KEY, periodId]`)。
 * 読む範囲が期間で変わるためで、B2からの無効化はこのキーの前方一致で全期間ぶんに効く。
 */
export const TRANSACTIONS_DATA_QUERY_KEY = ["transactions-data"] as const;

/**
 * B3が1回の表示で読む取引の上限件数(docs/transaction-import-requirements.md 8章)。
 *
 * 取引は資産残高と違って際限なく増える。資産推移は当月が日次・それ以前は月末のみで10年分でも
 * 数百件にしかならないが、取引は月に数百件のペースで積み上がるため、全件を読むと表示のたびに
 * 読み取りが増え続ける。選択中の期間で範囲クエリを掛けたうえで、さらにこの件数で打ち切る。
 *
 * **`limit()`に渡すのは`TRANSACTION_SCAN_LIMIT + 1`で、`FIRESTORE_QUERY_LIMIT_MAX`を
 * 超えられないのはそちらの値。** 1件余分に読むのは「上限を超えて存在するか」を判定するためで、
 * 取得件数が上限とちょうど一致しただけの場合に打ち切りの案内を出さないようにする。
 *
 * 要件が定める9,999をそのまま書かず`- 1`で導いてあるのは、**この2つの値が必ずセットで動く**
 * ことを値の側で保証するため。9,999と10,000を別々に置くと、読める件数を増やすつもりで
 * 前者だけを10,000にしたときに`limit()`へ10,001が渡り、クエリごと`invalid-argument`で
 * 拒否されて**1件も読めなくなる**(B1-3で踏んだのと同じ罠)。読み取りコストの都合でこれより
 * 小さくするのは構わないので、`firestore-scan-limit.test.ts`は一致ではなく上限として検査する。
 */
export const TRANSACTION_SCAN_LIMIT = FIRESTORE_QUERY_LIMIT_MAX - 1;

/** 期間絞り込みの選択肢(docs/screen-requirements-dashboard.md B3) */
export const TRANSACTION_PERIODS: TransactionPeriod[] = [
  { id: "1m", label: "直近1ヶ月" },
  { id: "3m", label: "直近3ヶ月" },
  { id: "this-year", label: "今年" },
  { id: "all", label: "全期間" },
];

/** 期間絞り込みの既定値 */
export const DEFAULT_TRANSACTION_PERIOD_ID: TransactionPeriodId = "1m";

/** 並び替えの既定値。初期表示は日付の新しい順 */
export const DEFAULT_TRANSACTION_SORT_KEY: TransactionSortKey = "date";
export const DEFAULT_TRANSACTION_SORT_DIRECTION: TransactionSortDirection = "desc";

/**
 * 「すべて」を表す費目・中項目・口座セレクタの選択値。
 * 未選択は内部的に空文字(`TransactionFilters.category`等)で表すが、Radix
 * `Select`のitem valueには空文字を使えないため、UI表示専用のダミー値を割り当てる。
 */
export const ALL_TRANSACTION_CATEGORIES_VALUE = "__all-categories__";
export const ALL_TRANSACTION_CATEGORY_MINORS_VALUE = "__all-category-minors__";
export const ALL_TRANSACTION_ACCOUNTS_VALUE = "__all-accounts__";

/**
 * 選択中の値が、読み込んだ期間に1件も無いときにラベルへ添える但し書き
 * (docs/screen-requirements-dashboard.md B3)。
 *
 * 選択肢から黙って外すと、結果が0件なのは「本当に無い」からなのか「選択が外れた」からなのかを
 * 画面から区別できない。打ち切りを黙って欠けさせないのと同じ理由で、消さずに理由を添える。
 */
export const buildUnavailableOptionLabel = (value: string): string =>
  `${value}(この期間に該当なし)`;

/** 1ページあたりの表示件数 */
export const TRANSACTIONS_PAGE_SIZE = 20;

/**
 * 絞り込み・並び替え・ページの状態をURLに載せるときのクエリパラメータ名。
 * リンク共有・ブラウザの戻る/進むで同じ表示を再現するため、これらはURLに持たせる
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
export const TRANSACTION_PERIOD_PARAM = "period";
export const TRANSACTION_CATEGORY_PARAM = "category";
export const TRANSACTION_CATEGORY_MINOR_PARAM = "subcategory";
export const TRANSACTION_ACCOUNT_PARAM = "account";
export const TRANSACTION_KEYWORD_PARAM = "q";
export const TRANSACTION_SORT_PARAM = "sort";
export const TRANSACTION_SORT_DIRECTION_PARAM = "dir";
export const TRANSACTION_PAGE_PARAM = "page";

/** 「CSVを取り込む」ボタンの導線 */
export const TRANSACTIONS_CSV_IMPORT_LINK = {
  label: "CSVを取り込む",
  href: CSV_IMPORT_PATH,
} as const;

/** 取引データが1件も無いときの案内(「全期間」で0件のとき) */
export const NO_TRANSACTIONS_EMPTY_STATE = {
  message: "入出金明細のデータがまだありません。CSVを取り込むと取引が表示されます。",
  action: TRANSACTIONS_CSV_IMPORT_LINK,
} as const;

/**
 * 選択中の期間に取引が1件も無いときの案内。
 *
 * **「まだ取り込んでいない」と言い切らない。** Firestoreから読むのは選択中の期間だけなので
 * (docs/transaction-import-requirements.md 8章)、他の期間に取引があるかどうかをこの画面は
 * 知らない。既定が「直近1ヶ月」である以上、しばらく取り込んでいないだけで
 * `NO_TRANSACTIONS_EMPTY_STATE` が出ると、取り込み済みのデータを「無い」と伝えることになる。
 * 期間を広げる手も添えて、どちらの状態でも次の行動が分かるようにする。
 */
export const NO_TRANSACTIONS_IN_PERIOD_EMPTY_STATE = {
  message:
    "選択した期間に取引がありません。期間を広げるか、新しい入出金明細CSVを取り込んでください。",
  action: TRANSACTIONS_CSV_IMPORT_LINK,
} as const;

/** 絞り込み条件に一致する取引が無いときの表示 */
export const NO_MATCHING_TRANSACTIONS_LABEL = "条件に一致する取引がありません。";

/**
 * 収支の集計から外れる行に付ける印(docs/screen-requirements-dashboard.md B3)。
 *
 * **振替と計算対象外は別の印にする。** 前者はマネーフォワードが自動で付ける分類、後者は
 * ユーザーが下した判断で、意味が違う。印が無いと、一覧の金額を足してもB1の収支サマリと
 * 合わない理由が分からない(docs/transaction-import-requirements.md 5章)。
 */
export const TRANSFER_BADGE_LABEL = "振替";
export const NON_CALCULATION_TARGET_BADGE_LABEL = "計算対象外";

/** 印の意味を補う説明。バッジだけでは「なぜ外れるのか」までは伝わらない */
export const TRANSFER_BADGE_DESCRIPTION = "自口座間の移動のため収支の集計に含みません";
export const NON_CALCULATION_TARGET_BADGE_DESCRIPTION =
  "マネーフォワードで計算対象外に設定されているため収支の集計に含みません";
