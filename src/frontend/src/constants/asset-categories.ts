/** B4 資産分類マスタ設定画面で使う定数(docs/screen-requirements-dashboard.md B4) */

import { FIRESTORE_QUERY_LIMIT_MAX } from "@/constants/firebase";

/** 分類名の最大文字数。firestore.rulesの`categoryAxes`の検証と一致させる */
export const CATEGORY_AXIS_NAME_MAX_LENGTH = 40;

/**
 * 集計対象を読み込む対象範囲の上限(assetSnapshotsの走査件数)。
 * 資産残高は1日1行なので、10年分でもこの件数には収まる
 * (src/constants/csv-import.ts の`MAX_ASSET_BALANCE_ROWS`と同じ考え方)。
 *
 * 値は`FIRESTORE_QUERY_LIMIT_MAX`(Firestoreが`limit()`に許す最大値)そのもの。
 * **これより大きい値は置けない。** 超えるとクエリが`invalid-argument`で拒否され、
 * 選択肢が1件も出せなくなる(B1-3)。CSVを取り込んでいないアカウントと区別が付かない
 * 空の選択肢になるため、取り込み済みでも集計対象を選べない状態になる。
 */
export const ASSET_TYPE_SCAN_LIMIT = FIRESTORE_QUERY_LIMIT_MAX;

/** 一覧に出す集計対象の名前の表示件数。超過分は「ほかN件」にまとめる */
export const CATEGORY_AXIS_MEMBER_DISPLAY_LIMIT = 2;

/**
 * 1つの分類軸で選べる物件の件数(B4「集計対象に不動産を含める」)。
 *
 * 値は `firestore.rules` が `assetTypeNames`・`debtIds` の両方に置いている上限と揃える。
 * **登録順の足切りではなく選択数の上限**で、物件を51件以上登録していても、どの50件を
 * 選ぶかは自由(51件以上を1つの軸にまとめて選ぶことだけができない)。
 */
export const CATEGORY_AXIS_PROPERTY_MAX_COUNT = 50;

/** 集計対象を1件も選ばなかったときの表示(総資産のような軸を想定) */
export const CATEGORY_AXIS_ALL_TYPES_LABEL = "すべての資産種別が対象";

/**
 * 集計対象の2グループの見出し(B4「集計対象に負債を含める」)。
 *
 * 資産種別と負債を同じ一覧に混ぜず、グループを分けて出す。同じ配列に混ぜると
 * 識別子の性質が違う2つ(名前 / ID)が並ぶことになり、選択の意味も逆になる。
 */
export const CATEGORY_AXIS_ASSET_TYPE_GROUP_LABEL = "資産種別(複数選択可)";
export const CATEGORY_AXIS_DEBT_GROUP_LABEL = "負債(複数選択可)";

/**
 * 不動産のグループ見出し(B4「集計対象に不動産を含める」)。
 *
 * **「(手動)」を付ける。** 資産種別のグループにはCSV由来の「不動産」が並ぶことがあり
 * (マネーフォワードに不動産を登録している場合)、名前だけでは同じものに見えるため。
 */
export const CATEGORY_AXIS_PROPERTY_GROUP_LABEL = "不動産(手動)(複数選択可)";

/**
 * 未選択時の意味を各グループに添える文言。
 *
 * 資産種別は「未選択=すべて」、負債は「未選択=差し引かない」で**読み替えが非対称**。
 * 分かりにくいので画面上に明示するのが要件そのもの(B4)。両方を「未選択=すべて」に
 * しないのは、負債の選択を持たない既存の分類軸が、負債の登録と同時に黙って
 * 純資産の軸へ変わってしまうため。
 */
export const CATEGORY_AXIS_ALL_TYPES_HINT = CATEGORY_AXIS_ALL_TYPES_LABEL;
export const CATEGORY_AXIS_NO_DEBT_HINT = "負債は差し引かない";

/** 選択できる負債がまだ無いときの案内(B11で1件も登録していない状態) */
export const NO_DEBT_OPTIONS_NOTICE =
  "集計対象にできる負債がまだありません。負債入力画面で登録すると選択できるようになります。";

/** 負債の選択肢を読み込んでいるあいだの表示 */
export const DEBT_OPTIONS_LOADING_LABEL = "負債の選択肢を読み込んでいます...";

/**
 * 負債の選択肢を取得できないあいだ、保存を止めていることの説明。
 *
 * 選択肢が出せないまま保存すると、選択済みの負債が黙って外れた分類軸で上書きされる
 * (集計対象を選べないまま保存できてしまったのがB4-1・B4-2で、同じ落とし穴)。
 */
export const DEBT_OPTIONS_UNAVAILABLE_NOTICE =
  "負債の選択が読み込めないまま保存すると、選択済みの負債が集計対象から外れるため、選択肢を読み込めるまで保存できません。";

/** 未選択時の意味(不動産)。負債と同じく「未選択=含めない」で、資産種別とは非対称 */
export const CATEGORY_AXIS_NO_PROPERTY_HINT = "不動産は反映しない";

/** 選択できる物件がまだ無いときの案内(B5〜B7で1件も登録していない状態) */
export const NO_PROPERTY_OPTIONS_NOTICE =
  "集計対象にできる物件がまだありません。不動産一覧から登録すると選択できるようになります。";

/** 物件の選択肢を読み込んでいるあいだの表示 */
export const PROPERTY_OPTIONS_LOADING_LABEL = "物件の選択肢を読み込んでいます...";

/** 物件の選択肢を取得できないあいだ、保存を止めていることの説明(負債と同じ理由) */
export const PROPERTY_OPTIONS_UNAVAILABLE_NOTICE =
  "物件の選択が読み込めないまま保存すると、選択済みの物件が集計対象から外れるため、選択肢を読み込めるまで保存できません。";

/**
 * 物件の反映方法を選ぶチェックボックスの文言(B4)。
 *
 * チェックがある物件は利ざや(時価 - ローン残高)、無い物件は時価を反映する。
 * 選んだ物件の行にだけ出す — 選んでいない物件に反映方法だけが残っていると、
 * 何が集計されるのか行から読めないため。
 */
export const CATEGORY_AXIS_SPREAD_ONLY_LABEL = "利ざやのみ反映(時価 - ローン残高)";

/**
 * 物件を選んだときの既定の反映方法(B4)。
 *
 * **利ざやを既定にする。** このカードの目的が利ざやの反映であることに加え、時価を既定に
 * すると、ローンが残っている物件を選んだ瞬間に控除前の額がダッシュボードへ載る。
 * 少なく出るほうを既定にする。
 */
export const CATEGORY_AXIS_DEFAULT_VALUATION_MODE: RealEstateValuationMode = "spread";

/**
 * CSV取込データとの重複の注意(カードで指定された赤字の文言)。
 *
 * マネーフォワードに不動産を登録していると、資産残高CSVにも資産種別として同じ物件が
 * 現れる。同じ物件をここで選ぶと同じ資産を2回数えるが、物件名とCSVの列名は一致せず
 * 金額も別物なので、アプリ側で突き合わせて防ぐことはできない(B1「CSV取込データとの重複」)。
 *
 * 見出しの「注意」は**赤字が入力エラーに読まれないため**に添える(DESIGN.md 3章で負債の
 * 金額に必ずラベルを添えるのと同じ理由)。置き場所も入力エラーが出る欄の直下ではなく
 * 選択肢の上にする。
 */
export const CATEGORY_AXIS_CSV_DUPLICATION_WARNING = {
  label: "注意",
  message:
    "CSV取込データとの重複に注意してください。マネーフォワードに登録済みの不動産は資産種別としてCSVにも現れるため、同じ物件をここで選ぶと二重に集計されます。",
} as const;

/**
 * 利ざやで反映する物件のローンを負債にも選んだときの二重控除の注記(B4)。
 *
 * **赤字にしない。** 2つの注意を同じ強さで並べると、カードで指定された重複の注意が埋もれる。
 */
export const CATEGORY_AXIS_DOUBLE_DEDUCTION_NOTICE =
  "「利ざやのみ反映」にした物件のローンを下の負債でも選ぶと、同じローンを二重に差し引きます。";

/**
 * 一覧の紐付け状況に添える負債の件数(B4)。
 *
 * **負債を含む軸にだけ出す。** 含まない軸に「負債なし」と書き添えると、大半の軸に
 * 同じ但し書きが並ぶだけになる。負債を含む軸かどうかが一覧で分からないと、
 * B1で値が資産合計と違う理由が追えない。
 *
 * 数えるのは**実際に差し引かれる負債**で、B11で削除済みの参照は含めない
 * (削除済みの分は`buildCategoryAxisMissingDebtLabel`で別に添える)。
 */
export const buildCategoryAxisDebtCountLabel = (count: number): string => `負債 ${count}件`;

/**
 * 一覧の紐付け状況に添える不動産の件数(B4)。負債の件数と同じ扱い。
 *
 * **利ざや / 時価の内訳は出さない。** 反映方法は物件ごとに変わるので、内訳まで並べると
 * 1行に収まらなくなる。何をどちらで反映しているかは編集フォームで確かめる(B4)。
 */
export const buildCategoryAxisPropertyCountLabel = (count: number): string => `不動産 ${count}件`;

/** 一覧で、削除済みの物件を参照している軸にだけ件数へ添える注記(負債と同じ理由・同じ形) */
export const buildCategoryAxisMissingPropertyLabel = (count: number): string =>
  `(${count}件は削除済み)`;

/** 編集フォームで、削除済みの物件への参照を選択から外したことの案内(負債と同じ組み立て) */
export const buildCategoryAxisMissingPropertyMessage = (count: number): string =>
  `集計対象にしていた物件のうち${count}件が見つからないため、選択から外しました。この内容で保存すると、分類軸に残っている参照も消えます。`;

/**
 * 一覧で、B11で削除済みの負債を参照している軸にだけ件数へ添える注記(B4)。
 *
 * 黙って外すと、その分類軸が何を差し引いているかが変わったことに気付けず、B1の値が
 * 前と違う理由を追えなくなる。B8が対象分類の削除で既定へ戻すときに「その旨を表示する」
 * としているのと同じ理由(docs/screen-requirements-fire-goal.md B8)。
 */
export const buildCategoryAxisMissingDebtLabel = (count: number): string =>
  `(${count}件は削除済み)`;

/**
 * 編集フォームで、B11で削除済みの負債への参照を選択から外したことの案内(B4)。
 *
 * 文言はB8の`ACHIEVEMENT_AXIS_MISSING_MESSAGE`に揃える —
 * 「見つからない」→「こう扱った」→「必要なら選び直して保存」の順。
 * 保存すれば分類軸に残っている参照も消えることまで書くのは、外した状態が画面上だけの
 * ものなのか保存済みなのかが、チェックボックスの見た目からは分からないため。
 */
export const buildCategoryAxisMissingDebtMessage = (count: number): string =>
  `集計対象にしていた負債のうち${count}件が見つからないため、選択から外しました。この内容で保存すると、分類軸に残っている参照も消えます。`;

/** 集計対象の選択肢がまだ無いときの案内(CSVを一度も取り込んでいない状態) */
export const NO_ASSET_TYPE_OPTIONS_NOTICE =
  "集計対象にできる資産種別がまだありません。CSVを取り込むと選択できるようになります。";

/** 登録済み分類が1件も無いときの案内 */
export const NO_CATEGORY_AXES_LABEL =
  "分類軸がまだ登録されていません。「新規分類を追加」から登録してください。";

/** 分類名が未入力のときのエラー */
export const CATEGORY_AXIS_NAME_REQUIRED_MESSAGE = "分類名を入力してください。";

/** 分類名が長すぎるときのエラー */
export const CATEGORY_AXIS_NAME_TOO_LONG_MESSAGE = `分類名は${CATEGORY_AXIS_NAME_MAX_LENGTH}文字以内で入力してください。`;

/**
 * 1つの分類軸で選べる物件の件数を超えたときのエラー(B4)。
 *
 * **登録順の足切りではなく選択数の上限**なので、「どの50件を選ぶかは自由」と読める文言にする。
 * 負債は登録そのものが50件で止まる(`DEBT_MAX_COUNT`)ため同じ状態にならないが、物件は
 * 登録件数を縛っていないので51件目以降を選ぼうとすればここに来る。
 */
export const CATEGORY_AXIS_PROPERTY_TOO_MANY_MESSAGE = `1つの分類軸で選べる物件は${CATEGORY_AXIS_PROPERTY_MAX_COUNT}件までです。選択を減らしてから保存してください。`;

/**
 * 削除禁止時のダイアログの本文(モックの文言に合わせる)。
 *
 * 負債だけ・物件だけが紐づいている分類も同じく削除できない。集計対象が割り当てられた
 * 分類軸を消させないという制約を資産・負債・不動産で分ける理由が無いため(B4の遷移条件)。
 *
 * **数えるのは「実際に集計対象になっている件数」で、参照の件数ではない。** B11で削除済みの
 * 負債しか参照していない分類軸は何も集計していないので、この文言の対象にならない(B4-3)。
 */
export const DELETE_CATEGORY_AXIS_BLOCKED_MESSAGE =
  "この分類には集計対象(資産種別・不動産・負債)が紐づいているため、削除できません。先に編集で割り当てを解除してください。";

/**
 * 負債の情報が揃っておらず、削除してよいかを判定できないときの本文。
 *
 * 上の「集計対象が紐づいている」とは**別の文言にする**。参照している負債がB11に残って
 * いるかどうかが分からない状態であって、紐づいていると判明したわけではない。同じ文言に
 * すると、取得に失敗しただけの分類軸を「集計対象がある」と読ませることになる
 * (`resolveCategoryAxisDebtReferences` / `resolveCategoryAxisPropertyReferences`が`null`を
 * 返すときの扱いと揃える)。
 *
 * **負債と不動産で文言を分けない。** どちらが揃っていないかはユーザーに取れる手を変えず
 * (待つか、時間をおいて開き直すか)、分けると「負債は取れたが物件は取れていない」の
 * 組み合わせの数だけ文言が増える(B4の遷移条件で「物件の扱いは負債とすべて同じ」と
 * 決めているのと同じ理由)。
 *
 * **読み込み中と取得失敗で分ける。** 前者は待てば必ず判定できるようになり、後者はそうとは
 * 限らない。同じ文言にすると、読み込み中のユーザーに再試行を促すことになる。
 *
 * **どちらも画面の更新を指示しない。** `QueryClient`は既定の設定で使っており、失敗しても
 * 自動でリトライし、ウィンドウのフォーカスが戻ったときや再マウント時にも取り直す
 * (`src/components/providers/QueryProvider.tsx`)。手動の再読み込みは要らない。
 */
export const DELETE_CATEGORY_AXIS_UNDETERMINED_MESSAGES: Record<"loading" | "error", string> = {
  loading:
    "負債・不動産の情報を読み込んでいるため、この分類を削除してよいか判定できません。読み込みが終わるまでお待ちください。",
  error:
    "負債・不動産の情報を取得できなかったため、この分類を削除してよいか判定できません。時間をおいて、もう一度お試しください。",
};

/** 削除確認ダイアログの本文 */
export const buildDeleteCategoryAxisConfirmMessage = (name: string): string =>
  `分類「${name}」を削除します。この操作は取り消せません。`;

/**
 * 分類軸一覧・集計対象の選択肢を**取得**できなかったときの文言。
 *
 * 保存・削除の失敗(`CATEGORY_AXIS_FAILURE_MESSAGES`)とは別に持つ。表示できないことと
 * 操作できないことでは次にすべきことが違い、「操作に失敗しました」では読めないため。
 * 取得の失敗を空状態(未取込・未登録)として見せないのがこの文言の目的(B1・B5と同じ扱い)。
 */
export const CATEGORY_AXIS_LOAD_FAILURE_MESSAGES: Record<AssetCategoryFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから表示してください。",
  "configuration-error": "Firebaseの設定が読み込めないため表示できません。",
  "permission-denied": "このデータの参照が許可されていません。ログインし直してください。",
  unknown: "データを取得できませんでした。時間をおいて再度お試しください。",
};

/** 集計対象の選択肢を読み込んでいるあいだの表示(A7の「リンクを確認しています...」と同じ扱い) */
export const ASSET_TYPE_OPTIONS_LOADING_LABEL = "集計対象の選択肢を読み込んでいます...";

/**
 * 集計対象の選択肢を取得できないあいだ、保存を止めていることの説明。
 *
 * 選択肢が出せないまま保存すると、集計対象を1件も選べず「すべての資産種別が対象」の
 * 分類軸ができてしまう(B1-3で実際に起きた)。意図しない軸を作らせない。
 */
export const ASSET_TYPE_OPTIONS_UNAVAILABLE_NOTICE =
  "集計対象を選べないまま保存すると、すべての資産種別が対象の分類軸になるため、選択肢を読み込めるまで保存できません。";

/** 分類軸の取得・保存・削除が失敗したときの文言 */
export const CATEGORY_AXIS_FAILURE_MESSAGES: Record<AssetCategoryFailureReason, string> = {
  "signed-out": "ログイン状態が切れています。ログインし直してから操作してください。",
  "configuration-error": "Firebaseの設定が読み込めないため操作できません。",
  "permission-denied": "この操作は許可されていません。ログインし直すか、画面を更新してください。",
  unknown: "操作に失敗しました。時間をおいて再度お試しください。",
};

/** 分類軸一覧のキャッシュキー(TanStack Query) */
export const CATEGORY_AXES_QUERY_KEY = ["category-axes"] as const;

/** 集計対象の選択肢(既知の資産種別名)のキャッシュキー(TanStack Query) */
export const ASSET_TYPE_OPTIONS_QUERY_KEY = ["asset-type-options"] as const;
