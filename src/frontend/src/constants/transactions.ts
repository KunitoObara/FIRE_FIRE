/** B3 収支明細一覧画面で使う定数 */

import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";
import { CSV_IMPORT_PATH } from "@/constants/routes";

/**
 * サンプルデータを表示するかどうか。
 *
 * B3がまだFirestoreの取引データを読んでおらず、画面の見た目を確認できるようサンプルデータを
 * 流し込んでいる。**入出金明細CSVの取込(B2)自体はB2-3で実装済み**で、取り込んだ取引は
 * `users/{uid}/transactions`に入るが、ここを繋ぐのは[B3-1]の範囲になる。繋いだ時点で`false`に
 * して`src/lib/transactions/sample-data.ts`ごと外す。B1が同じ形のフラグで暫定表示していたのを
 * 実データ接続時に外したのと同じ手順になる(カード[B1-2])。
 *
 * `false`にすると一覧が空状態(CSV取込への導線)になる。
 */
export const USE_SAMPLE_TRANSACTIONS_DATA = true;

/** サンプルデータ表示中であることを画面に明示する文言。実データと取り違えないためのもの */
export const SAMPLE_TRANSACTIONS_DATA_NOTICE =
  "表示中の取引はすべてサンプルです。取り込んだ入出金明細の表示は今後のアップデートで対応します。";

/**
 * B3が表示する取引データのキャッシュキー(TanStack Query)。
 *
 * B2で入出金明細を取り込んだ直後にこのキーを無効化する。取り込んだ取引はB3の一覧そのもので、
 * 戻ったときに古い内容を見せないため(docs/screen-requirements-dashboard.md B2
 * 「入出金明細タブ」。資産残高推移タブが`DASHBOARD_DATA_QUERY_KEY`を落としているのと同じ)。
 *
 * **現時点でこのキーを購読しているものは無い。** B3はまだServer Componentのまま
 * サンプルデータを表示しており(`USE_SAMPLE_TRANSACTIONS_DATA`)、Firestoreへ繋ぎ込む
 * [B3-1]でこのキーを読む側が入る。取込の側だけ後から足すと、B2を触らないカードで
 * 「取り込んだのに一覧が古い」に気付く必要が出るため、先に置いてある。
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
 * 「すべて」を表す費目・口座セレクタの選択値。
 * 未選択は内部的に空文字(`TransactionFilters.category`/`account`)で表すが、Radix
 * `Select`のitem valueには空文字を使えないため、UI表示専用のダミー値を割り当てる。
 */
export const ALL_TRANSACTION_CATEGORIES_VALUE = "__all-categories__";
export const ALL_TRANSACTION_ACCOUNTS_VALUE = "__all-accounts__";

/** 1ページあたりの表示件数 */
export const TRANSACTIONS_PAGE_SIZE = 20;

/**
 * 絞り込み・並び替え・ページの状態をURLに載せるときのクエリパラメータ名。
 * リンク共有・ブラウザの戻る/進むで同じ表示を再現するため、これらはURLに持たせる
 * (src/frontend/docs/CODING_STANDARDS.md 2章)。
 */
export const TRANSACTION_PERIOD_PARAM = "period";
export const TRANSACTION_CATEGORY_PARAM = "category";
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

/** 取引データが1件も無いときの案内 */
export const NO_TRANSACTIONS_EMPTY_STATE = {
  message: "入出金明細のデータがまだありません。CSVを取り込むと取引が表示されます。",
  action: TRANSACTIONS_CSV_IMPORT_LINK,
} as const;

/** 絞り込み条件に一致する取引が無いときの表示 */
export const NO_MATCHING_TRANSACTIONS_LABEL = "条件に一致する取引がありません。";
